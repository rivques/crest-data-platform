"""
Service layer for sensor management, including dynamic table creation.
"""

import logging
import re
from django.db import connection, models
from django.utils import timezone

from .models import Sensor, SensorApiKey
from .schemas import ALLOWED_COLUMN_TYPES, validate_column_schema

logger = logging.getLogger(__name__)


class SensorTableService:
    """Service for managing dynamic sensor data tables."""
    
    @staticmethod
    def generate_table_name(sensor_type: str, sensor_id: str) -> str:
        """
        Generate a unique table name for a sensor.
        Format: sensor_{type}_{short_uuid}
        """
        # Sanitize sensor type (alphanumeric and underscore only)
        safe_type = re.sub(r'[^a-z0-9_]', '', sensor_type.lower())
        # Use first 8 chars of UUID
        short_id = str(sensor_id).replace('-', '')[:8]
        return f"sensor_{safe_type}_{short_id}"
    
    # Use the validate_column_schema from schemas.py
    validate_column_schema = staticmethod(validate_column_schema)
    
    @staticmethod
    def create_sensor_table(sensor: Sensor) -> bool:
        """
        Create the data table for a sensor.
        Returns True if successful.
        """
        table_name = sensor.table_name
        columns = sensor.column_schema
        
        # Build column definitions
        column_defs = [
            "id BIGSERIAL PRIMARY KEY",
            "experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL",
            "timestamp TIMESTAMPTZ NOT NULL",
        ]
        
        for col_name, col_type in columns.items():
            # Sanitize column name
            safe_name = re.sub(r'[^a-z0-9_]', '', col_name.lower())
            column_defs.append(f"{safe_name} {col_type}")
        
        column_defs.append("created_at TIMESTAMPTZ DEFAULT NOW()")
        
        # Create table SQL
        sql = f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            {', '.join(column_defs)}
        );
        CREATE INDEX IF NOT EXISTS idx_{table_name}_timestamp ON {table_name}(timestamp);
        CREATE INDEX IF NOT EXISTS idx_{table_name}_experiment ON {table_name}(experiment_id);
        """
        
        try:
            with connection.cursor() as cursor:
                cursor.execute(sql)
            logger.info(f"Created sensor table: {table_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to create sensor table {table_name}: {e}")
            raise
    
    @staticmethod
    def drop_sensor_table(table_name: str) -> bool:
        """
        Drop a sensor's data table.
        Use with caution - this deletes all data!
        """
        # Extra safety: only allow dropping tables with sensor_ prefix
        if not table_name.startswith('sensor_'):
            raise ValueError("Can only drop tables with 'sensor_' prefix")
        
        sql = f"DROP TABLE IF EXISTS {table_name} CASCADE;"
        
        try:
            with connection.cursor() as cursor:
                cursor.execute(sql)
            logger.info(f"Dropped sensor table: {table_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to drop sensor table {table_name}: {e}")
            raise
    
    @staticmethod
    def get_table_columns(table_name: str) -> list[dict]:
        """Get the column information for a sensor table."""
        sql = """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position;
        """
        
        with connection.cursor() as cursor:
            cursor.execute(sql, [table_name])
            rows = cursor.fetchall()
        
        return [
            {"name": row[0], "type": row[1], "nullable": row[2] == 'YES'}
            for row in rows
        ]
    
    @staticmethod
    def insert_reading(sensor: Sensor, data: dict, experiment_id: str = None) -> int:
        """
        Insert a reading into a sensor's data table.
        Returns the ID of the inserted row.
        """
        table_name = sensor.table_name
        timestamp = data.get('timestamp', timezone.now())
        
        # Build column names and values
        columns = ['experiment_id', 'timestamp']
        values = [experiment_id, timestamp]
        placeholders = ['%s', '%s']
        
        for col_name in sensor.column_schema.keys():
            if col_name in data:
                columns.append(col_name)
                values.append(data[col_name])
                placeholders.append('%s')
        
        sql = f"""
        INSERT INTO {table_name} ({', '.join(columns)})
        VALUES ({', '.join(placeholders)})
        RETURNING id;
        """
        
        with connection.cursor() as cursor:
            cursor.execute(sql, values)
            row_id = cursor.fetchone()[0]
        
        # Update sensor stats
        Sensor.objects.filter(id=sensor.id).update(
            last_reading_at=timezone.now(),
            reading_count=models.F('reading_count') + 1
        )
        
        return row_id
    
    @staticmethod
    def insert_readings_batch(sensor: Sensor, readings: list[dict], experiment_id: str = None) -> int:
        """
        Insert multiple readings in a batch.
        Returns the number of rows inserted.
        """
        if not readings:
            return 0
        
        table_name = sensor.table_name
        schema_columns = list(sensor.column_schema.keys())
        
        # Build the INSERT statement
        columns = ['experiment_id', 'timestamp'] + schema_columns
        
        rows_data = []
        for reading in readings:
            timestamp = reading.get('timestamp', timezone.now())
            row = [experiment_id, timestamp]
            for col in schema_columns:
                row.append(reading.get(col))
            rows_data.append(row)
        
        # Create placeholders for each row
        placeholders = ', '.join(['%s'] * len(columns))
        values_placeholder = ', '.join([f'({placeholders})' for _ in readings])
        
        sql = f"""
        INSERT INTO {table_name} ({', '.join(columns)})
        VALUES {values_placeholder};
        """
        
        # Flatten the rows_data for execute
        flat_values = [val for row in rows_data for val in row]
        
        with connection.cursor() as cursor:
            cursor.execute(sql, flat_values)
            count = cursor.rowcount
        
        # Update sensor stats
        Sensor.objects.filter(id=sensor.id).update(
            last_reading_at=timezone.now(),
            reading_count=models.F('reading_count') + count
        )
        
        return count


def create_sensor(
    name: str,
    sensor_type: str,
    column_schema: dict,
    created_by,
    experiment=None,
    description: str = "",
    metadata: dict = None
) -> Sensor:
    """
    Create a new sensor with its data table.
    
    Args:
        name: Human-readable name for the sensor
        sensor_type: A label for this type of sensor (e.g., 'temperature', 'air_quality')
        column_schema: Dictionary mapping column names to PostgreSQL types
        created_by: User creating the sensor
        experiment: Optional experiment to associate with
        description: Optional description
        metadata: Optional additional metadata
    """
    import uuid as uuid_module
    
    # Validate column schema
    is_valid, error = validate_column_schema(column_schema)
    if not is_valid:
        raise ValueError(error)
    
    # Generate a UUID for the sensor
    sensor_id = uuid_module.uuid4()
    
    # Generate table name
    table_name = SensorTableService.generate_table_name(sensor_type, sensor_id)
    
    # Create sensor record
    sensor = Sensor.objects.create(
        id=sensor_id,
        name=name,
        sensor_type=sensor_type,
        table_name=table_name,
        description=description,
        column_schema=column_schema,
        experiment=experiment,
        created_by=created_by,
        metadata=metadata or {},
    )
    
    # Create the data table
    SensorTableService.create_sensor_table(sensor)
    
    return sensor
