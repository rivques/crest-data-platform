"""
Service for querying sensor data from dynamic tables.
"""

import re
from django.db import connection
from django.utils import timezone
from datetime import datetime, timedelta
from typing import Optional


# Base columns that always exist in sensor tables
BASE_ORDER_COLUMNS = {'timestamp', 'id', 'created_at', 'experiment_id'}

# Valid intervals for aggregation queries
VALID_INTERVALS = {'1 minute', '5 minutes', '15 minutes', '1 hour', '1 day'}


def _validate_column_name(column: str) -> bool:
    """Validate that a column name is safe (alphanumeric and underscore only)."""
    return bool(re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', column))


class DataQueryService:
    """Service for querying data from sensor tables."""
    
    @staticmethod
    def query_sensor_data(
        table_name: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        experiment_id: Optional[str] = None,
        limit: int = 1000,
        offset: int = 0,
        order_by: str = 'timestamp',
        order_dir: str = 'DESC',
        valid_columns: Optional[set] = None
    ) -> tuple[list[dict], int]:
        """
        Query data from a sensor's table.
        
        Args:
            valid_columns: Optional set of valid column names from sensor schema.
                          Used to validate order_by parameter.
        
        Returns (rows, total_count).
        """
        # Safety check
        if not table_name.startswith('sensor_'):
            raise ValueError("Invalid table name")
        
        # Validate order_by column to prevent SQL injection
        # Must be either a base column or a valid schema column
        allowed_order_columns = BASE_ORDER_COLUMNS.copy()
        if valid_columns:
            allowed_order_columns.update(valid_columns)
        
        order_by_lower = order_by.lower()
        if order_by_lower not in allowed_order_columns:
            raise ValueError(f"Invalid order_by column: '{order_by}'. Allowed: {sorted(allowed_order_columns)}")
        
        # Use the validated lowercase version
        safe_order_by = order_by_lower
        
        # Build WHERE clause
        conditions = []
        params = []
        
        if start_time:
            conditions.append("timestamp >= %s")
            params.append(start_time)
        
        if end_time:
            conditions.append("timestamp <= %s")
            params.append(end_time)
        
        if experiment_id:
            conditions.append("experiment_id = %s")
            params.append(experiment_id)
        
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        # Validate order direction
        order_dir = order_dir.upper()
        if order_dir not in ('ASC', 'DESC'):
            order_dir = 'DESC'
        
        # Get total count
        count_sql = f"SELECT COUNT(*) FROM {table_name} {where_clause}"
        
        with connection.cursor() as cursor:
            cursor.execute(count_sql, params)
            total_count = cursor.fetchone()[0]
        
        # Get data - safe_order_by has been validated against allowlist
        data_sql = f"""
        SELECT * FROM {table_name}
        {where_clause}
        ORDER BY {safe_order_by} {order_dir}
        LIMIT %s OFFSET %s
        """
        
        with connection.cursor() as cursor:
            cursor.execute(data_sql, params + [limit, offset])
            columns = [col[0] for col in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        return rows, total_count
    
    @staticmethod
    def get_latest_reading(table_name: str) -> Optional[dict]:
        """Get the most recent reading from a sensor."""
        if not table_name.startswith('sensor_'):
            raise ValueError("Invalid table name")
        
        sql = f"""
        SELECT * FROM {table_name}
        ORDER BY timestamp DESC
        LIMIT 1
        """
        
        with connection.cursor() as cursor:
            cursor.execute(sql)
            if cursor.rowcount == 0:
                return None
            columns = [col[0] for col in cursor.description]
            row = cursor.fetchone()
            return dict(zip(columns, row))
    
    @staticmethod
    def get_aggregated_data(
        table_name: str,
        column: str,
        aggregation: str = 'avg',
        interval: str = '1 hour',
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        experiment_id: Optional[str] = None,
        valid_columns: Optional[set] = None
    ) -> list[dict]:
        """
        Get time-bucketed aggregated data.
        
        Args:
            aggregation: 'avg', 'min', 'max', 'sum', 'count'
            interval: Time bucket interval - must be one of VALID_INTERVALS
            valid_columns: Optional set of valid column names from sensor schema.
                          Used to validate column parameter.
        """
        if not table_name.startswith('sensor_'):
            raise ValueError("Invalid table name")
        
        # Validate aggregation
        valid_aggs = {'avg', 'min', 'max', 'sum', 'count'}
        if aggregation.lower() not in valid_aggs:
            raise ValueError(f"Invalid aggregation. Use one of: {sorted(valid_aggs)}")
        
        # Validate interval to prevent SQL injection
        if interval not in VALID_INTERVALS:
            raise ValueError(f"Invalid interval: '{interval}'. Allowed: {sorted(VALID_INTERVALS)}")
        
        # Validate column name format and against schema
        if not _validate_column_name(column):
            raise ValueError(f"Invalid column name format: '{column}'")
        
        column_lower = column.lower()
        if valid_columns is not None:
            if column_lower not in valid_columns and column_lower != 'timestamp':
                raise ValueError(f"Column '{column}' not found in sensor schema")
        
        safe_column = column_lower
        safe_aggregation = aggregation.upper()
        
        # Build WHERE clause
        conditions = []
        params = []
        
        if start_time:
            conditions.append("timestamp >= %s")
            params.append(start_time)
        
        if end_time:
            conditions.append("timestamp <= %s")
            params.append(end_time)
        
        if experiment_id:
            conditions.append("experiment_id = %s")
            params.append(experiment_id)
        
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        # Use date_trunc for common intervals (validated above)
        # Map interval to PostgreSQL date_trunc precision
        interval_to_trunc = {
            '1 minute': 'minute',
            '5 minutes': 'minute',  # Will use more complex bucketing
            '15 minutes': 'minute',  # Will use more complex bucketing
            '1 hour': 'hour',
            '1 day': 'day',
        }
        
        truncate_to = interval_to_trunc.get(interval)
        
        if interval in ['1 hour', '1 day', '1 minute']:
            # Simple date_trunc for exact intervals
            sql = f"""
            SELECT 
                date_trunc('{truncate_to}', timestamp) AS bucket,
                {safe_aggregation}({safe_column}) as value,
                COUNT(*) as count
            FROM {table_name}
            {where_clause}
            GROUP BY bucket
            ORDER BY bucket ASC
            """
        else:
            # For 5/15 minute intervals, use time bucketing
            minutes = int(interval.split()[0])
            sql = f"""
            SELECT 
                date_trunc('hour', timestamp) + 
                (EXTRACT(minute FROM timestamp)::int / {minutes} * {minutes}) * interval '1 minute' AS bucket,
                {safe_aggregation}({safe_column}) as value,
                COUNT(*) as count
            FROM {table_name}
            {where_clause}
            GROUP BY bucket
            ORDER BY bucket ASC
            """
        
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            columns = [col[0] for col in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        return rows
    
    @staticmethod
    def get_sensor_stats(table_name: str, column: str, valid_columns: Optional[set] = None) -> dict:
        """Get statistics for a numeric column."""
        if not table_name.startswith('sensor_'):
            raise ValueError("Invalid table name")
        
        # Validate column name format
        if not _validate_column_name(column):
            raise ValueError(f"Invalid column name format: '{column}'")
        
        column_lower = column.lower()
        if valid_columns is not None:
            if column_lower not in valid_columns:
                raise ValueError(f"Column '{column}' not found in sensor schema")
        
        safe_column = column_lower
        
        sql = f"""
        SELECT 
            COUNT(*) as count,
            MIN({safe_column}) as min,
            MAX({safe_column}) as max,
            AVG({safe_column}) as avg,
            STDDEV({safe_column}) as stddev,
            MIN(timestamp) as first_reading,
            MAX(timestamp) as last_reading
        FROM {table_name}
        """
        
        with connection.cursor() as cursor:
            cursor.execute(sql)
            columns = [col[0] for col in cursor.description]
            row = cursor.fetchone()
            return dict(zip(columns, row)) if row else {}

