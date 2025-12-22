from rest_framework import serializers
from django.utils import timezone


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


class IngestResponseSerializer(serializers.Serializer):
    """Serializer for the ingest API response."""
    
    success = serializers.BooleanField()
    sensor_id = serializers.UUIDField()
    readings_accepted = serializers.IntegerField()
    message = serializers.CharField(required=False)
