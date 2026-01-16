from rest_framework import serializers
from django.utils import timezone
import json

# Maximum size limits for ingest data to prevent memory exhaustion
MAX_READING_SIZE_BYTES = 10 * 1024  # 10KB per reading
MAX_STRING_VALUE_LENGTH = 10000  # 10K characters for string values
MAX_TOTAL_PAYLOAD_BYTES = 5 * 1024 * 1024  # 5MB total payload


class ReadingSerializer(serializers.Serializer):
    """Serializer for a single reading."""
    
    timestamp = serializers.DateTimeField(required=False, default=timezone.now)
    experiment_id = serializers.UUIDField(required=False, allow_null=True)
    
    # Additional fields will be validated dynamically based on sensor schema
    
    def __init__(self, *args, sensor=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.sensor = sensor
    
    def to_internal_value(self, data):
        """Convert incoming data, allowing dynamic fields based on sensor schema."""
        ret = super().to_internal_value(data)
        
        if self.sensor:
            # Add sensor-specific fields
            for col_name, col_type in self.sensor.column_schema.items():
                if col_name in data:
                    ret[col_name] = data[col_name]
        
        return ret


def validate_reading_size(reading: dict) -> None:
    """Validate that a single reading doesn't exceed size limits."""
    # Check serialized size
    try:
        reading_json = json.dumps(reading)
        if len(reading_json.encode('utf-8')) > MAX_READING_SIZE_BYTES:
            raise serializers.ValidationError(
                f"Individual reading exceeds maximum size of {MAX_READING_SIZE_BYTES} bytes"
            )
    except (TypeError, ValueError) as e:
        raise serializers.ValidationError(f"Reading contains non-serializable data: {e}")
    
    # Check string value lengths
    for key, value in reading.items():
        if isinstance(value, str) and len(value) > MAX_STRING_VALUE_LENGTH:
            raise serializers.ValidationError(
                f"String value for '{key}' exceeds maximum length of {MAX_STRING_VALUE_LENGTH} characters"
            )


class IngestRequestSerializer(serializers.Serializer):
    """Serializer for the ingest API request."""
    
    sensor_id = serializers.UUIDField(required=False, help_text="Optional if using API key auth (sensor inferred)")
    experiment_id = serializers.UUIDField(required=False, allow_null=True)
    readings = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        max_length=1000,  # Batch limit
        help_text="Array of readings to ingest"
    )
    
    def validate_readings(self, value):
        """Validate readings don't exceed size limits."""
        for i, reading in enumerate(value):
            try:
                validate_reading_size(reading)
            except serializers.ValidationError as e:
                raise serializers.ValidationError(
                    f"Reading {i}: {getattr(e, 'detail', str(e))}"
                )
        return value


class IngestResponseSerializer(serializers.Serializer):
    """Serializer for the ingest API response."""
    
    success = serializers.BooleanField()
    sensor_id = serializers.UUIDField()
    readings_accepted = serializers.IntegerField()
    message = serializers.CharField(required=False)
