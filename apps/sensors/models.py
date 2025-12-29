import uuid
import hashlib
import secrets
from django.db import models
from django.conf import settings

from apps.experiments.models import Experiment


class Sensor(models.Model):
    """
    Represents a sensor device that reports data to the platform.
    Each sensor has its own dedicated data table with typed columns.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    sensor_type = models.CharField(max_length=50, help_text="Type of sensor (defines table schema)")
    table_name = models.CharField(max_length=100, unique=True, help_text="PostgreSQL table name for this sensor's data")
    
    description = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional sensor configuration")
    
    # Schema definition (stored for reference, especially for custom types)
    column_schema = models.JSONField(default=dict, help_text="Column definitions for the sensor's data table")
    
    experiment = models.ForeignKey(
        Experiment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sensors'
    )
    
    is_active = models.BooleanField(default=True)
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sensors'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Stats
    last_reading_at = models.DateTimeField(null=True, blank=True)
    reading_count = models.BigIntegerField(default=0)
    
    class Meta:
        db_table = 'sensors'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.sensor_type})"


class SensorApiKey(models.Model):
    """
    API key for sensor authentication.
    The actual key is only shown once at creation; we store a hash.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sensor = models.ForeignKey(
        Sensor,
        on_delete=models.CASCADE,
        related_name='api_keys'
    )
    
    name = models.CharField(max_length=100, help_text="Friendly name for this API key")
    key_hash = models.CharField(max_length=64, help_text="SHA256 hash of the API key")
    key_prefix = models.CharField(max_length=8, help_text="First 8 characters for identification")
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_api_keys'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'sensor_api_keys'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"
    
    @classmethod
    def generate_key(cls) -> str:
        """Generate a new random API key."""
        return secrets.token_urlsafe(32)
    
    @classmethod
    def hash_key(cls, key: str) -> str:
        """Hash an API key for storage."""
        return hashlib.sha256(key.encode()).hexdigest()
    
    @classmethod
    def create_for_sensor(cls, sensor: Sensor, name: str, created_by, expires_at=None):
        """
        Create a new API key for a sensor.
        Returns (api_key_instance, raw_key) - raw_key is only available at creation.
        """
        raw_key = cls.generate_key()
        api_key = cls.objects.create(
            sensor=sensor,
            name=name,
            key_hash=cls.hash_key(raw_key),
            key_prefix=raw_key[:8],
            created_by=created_by,
            expires_at=expires_at,
        )
        return api_key, raw_key
    
    def verify_key(self, raw_key: str) -> bool:
        """Verify that a raw key matches this API key."""
        return self.key_hash == self.hash_key(raw_key)


class ComputedFieldError(models.Model):
    """
    Logs errors that occur when computing a field value.
    Helps users debug their compute functions.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sensor = models.ForeignKey(
        Sensor,
        on_delete=models.CASCADE,
        related_name='computed_field_errors'
    )
    field_name = models.CharField(max_length=100, help_text="The computed field that failed")
    error_type = models.CharField(max_length=100, help_text="Type of error (e.g., 'SyntaxError', 'TimeoutError')")
    error_message = models.TextField(help_text="Full error message")
    input_data = models.JSONField(help_text="The input data that caused the error")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'computed_field_errors'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['sensor', '-created_at']),
        ]
    
    def __str__(self):
        return f"Error in {self.field_name} for sensor {self.sensor_id}: {self.error_type}"
