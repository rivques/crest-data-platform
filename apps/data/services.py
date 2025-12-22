"""
Service for querying sensor data from dynamic tables.
"""

from django.db import connection
from django.utils import timezone
from datetime import datetime, timedelta
from typing import Optional


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
        order_dir: str = 'DESC'
    ) -> tuple[list[dict], int]:
        """
        Query data from a sensor's table.
        
        Returns (rows, total_count).
        """
        # Safety check
        if not table_name.startswith('sensor_'):
            raise ValueError("Invalid table name")
        
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
        
        # Get data
        data_sql = f"""
        SELECT * FROM {table_name}
        {where_clause}
        ORDER BY {order_by} {order_dir}
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
        experiment_id: Optional[str] = None
    ) -> list[dict]:
        """
        Get time-bucketed aggregated data.
        
        aggregation: 'avg', 'min', 'max', 'sum', 'count'
        interval: PostgreSQL interval string (e.g., '1 hour', '15 minutes', '1 day')
        """
        if not table_name.startswith('sensor_'):
            raise ValueError("Invalid table name")
        
        # Validate aggregation
        valid_aggs = ['avg', 'min', 'max', 'sum', 'count']
        if aggregation.lower() not in valid_aggs:
            raise ValueError(f"Invalid aggregation. Use one of: {valid_aggs}")
        
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
        
        sql = f"""
        SELECT 
            date_trunc('hour', timestamp) + 
            (EXTRACT(minute FROM timestamp)::int / 
             EXTRACT(epoch FROM interval '{interval}')::int * 
             EXTRACT(epoch FROM interval '{interval}')::int) * interval '1 second' AS bucket,
            {aggregation.upper()}({column}) as value,
            COUNT(*) as count
        FROM {table_name}
        {where_clause}
        GROUP BY bucket
        ORDER BY bucket ASC
        """
        
        # Simpler approach using date_trunc for common intervals
        if interval in ['1 hour', '1 day', '1 minute']:
            truncate_to = interval.split()[1]
            sql = f"""
            SELECT 
                date_trunc('{truncate_to}', timestamp) AS bucket,
                {aggregation.upper()}({column}) as value,
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
    def get_sensor_stats(table_name: str, column: str) -> dict:
        """Get statistics for a numeric column."""
        if not table_name.startswith('sensor_'):
            raise ValueError("Invalid table name")
        
        sql = f"""
        SELECT 
            COUNT(*) as count,
            MIN({column}) as min,
            MAX({column}) as max,
            AVG({column}) as avg,
            STDDEV({column}) as stddev,
            MIN(timestamp) as first_reading,
            MAX(timestamp) as last_reading
        FROM {table_name}
        """
        
        with connection.cursor() as cursor:
            cursor.execute(sql)
            columns = [col[0] for col in cursor.description]
            row = cursor.fetchone()
            return dict(zip(columns, row))
