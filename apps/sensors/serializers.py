from rest_framework import serializers
from .models import Sensor, SensorApiKey
from .schemas import ALLOWED_COLUMN_TYPES, validate_column_schema


class SensorSerializer(serializers.ModelSerializer):
    """Serializer for sensor details."""
    
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    experiment_name = serializers.CharField(source='experiment.name', read_only=True, allow_null=True)
    api_key_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Sensor
        fields = [
            'id', 'name', 'sensor_type', 'table_name', 'description',
            'metadata', 'column_schema', 'experiment', 'experiment_name',
            'is_active', 'created_by', 'created_by_username',
            'created_at', 'updated_at',
            'last_reading_at', 'reading_count', 'api_key_count'
        ]
        read_only_fields = [
            'id', 'table_name', 'created_by',
            'created_at', 'updated_at', 'last_reading_at', 'reading_count'
        ]
    
    def get_api_key_count(self, obj):
        return obj.api_keys.filter(is_active=True).count()


class SensorCreateSerializer(serializers.Serializer):
    """Serializer for creating a new sensor with user-defined schema."""
    
    name = serializers.CharField(max_length=255)
    sensor_type = serializers.CharField(max_length=50, help_text="A label for this type of sensor (e.g., 'temperature', 'air_quality')")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    experiment = serializers.UUIDField(required=False, allow_null=True)
    metadata = serializers.JSONField(required=False, default=dict)
    
    # Column schema is now required for all sensors
    column_schema = serializers.JSONField(
        help_text="Dictionary mapping column names to PostgreSQL types. E.g., {'temp_c': 'DOUBLE PRECISION', 'humidity': 'DOUBLE PRECISION'}"
    )
    
    def validate_column_schema(self, value):
        """Validate the column schema."""
        is_valid, error = validate_column_schema(value)
        if not is_valid:
            raise serializers.ValidationError(error)
        return value


class SensorUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating a sensor (limited fields - cannot change schema)."""
    
    class Meta:
        model = Sensor
        fields = ['name', 'description', 'experiment', 'metadata', 'is_active']


class SensorApiKeySerializer(serializers.ModelSerializer):
    """Serializer for API key details (without the actual key)."""
    
    sensor_name = serializers.CharField(source='sensor.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = SensorApiKey
        fields = [
            'id', 'sensor', 'sensor_name', 'name', 'key_prefix',
            'created_by', 'created_by_username',
            'created_at', 'last_used_at', 'expires_at', 'is_active'
        ]
        read_only_fields = [
            'id', 'key_prefix', 'created_by', 'created_at', 'last_used_at'
        ]


class SensorApiKeyCreateSerializer(serializers.Serializer):
    """Serializer for creating a new API key."""
    
    sensor = serializers.UUIDField()
    name = serializers.CharField(max_length=100)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    
    def validate_sensor(self, value):
        try:
            Sensor.objects.get(id=value)
        except Sensor.DoesNotExist:
            raise serializers.ValidationError("Sensor not found.")
        return value


class SensorApiKeyResponseSerializer(serializers.Serializer):
    """Response serializer that includes the raw API key (only at creation)."""
    
    id = serializers.UUIDField()
    sensor = serializers.UUIDField()
    name = serializers.CharField()
    key_prefix = serializers.CharField()
    api_key = serializers.CharField(help_text="The full API key - save this, it won't be shown again!")
    created_at = serializers.DateTimeField()
    expires_at = serializers.DateTimeField(allow_null=True)


class ColumnTypesSerializer(serializers.Serializer):
    """Serializer for listing allowed column types."""
    
    types = serializers.ListField(
        child=serializers.CharField(),
        help_text="List of PostgreSQL column types allowed in sensor schemas"
    )

