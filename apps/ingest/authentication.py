"""
Custom authentication for sensor API keys.
"""

from django.utils import timezone
from rest_framework import authentication, exceptions

from apps.sensors.models import SensorApiKey


class SensorApiKeyAuthentication(authentication.BaseAuthentication):
    """
    Authentication using sensor API keys.
    
    Expects header: Authorization: Api-Key <key>
    """
    
    keyword = 'Api-Key'
    
    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header:
            return None
        
        parts = auth_header.split()
        
        if len(parts) != 2 or parts[0] != self.keyword:
            return None
        
        raw_key = parts[1]
        
        # Look up the API key by its hash
        key_hash = SensorApiKey.hash_key(raw_key)
        
        try:
            api_key = SensorApiKey.objects.select_related('sensor').get(
                key_hash=key_hash,
                is_active=True
            )
        except SensorApiKey.DoesNotExist:
            raise exceptions.AuthenticationFailed('Invalid API key.')
        
        # Check expiration
        if api_key.expires_at and api_key.expires_at < timezone.now():
            raise exceptions.AuthenticationFailed('API key has expired.')
        
        # Check if sensor is active
        if not api_key.sensor.is_active:
            raise exceptions.AuthenticationFailed('Sensor is not active.')
        
        # Update last used timestamp (async would be better for high-volume)
        SensorApiKey.objects.filter(id=api_key.id).update(last_used_at=timezone.now())
        
        # Return (user, auth) tuple - we use None for user since this is sensor auth
        # We attach the sensor and api_key to the request for use in views
        request.sensor = api_key.sensor
        request.api_key = api_key
        
        return (None, api_key)
    
    def authenticate_header(self, request):
        return self.keyword
