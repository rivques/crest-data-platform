import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import BasePermission

from apps.sensors.models import ComputedFieldError
from apps.sensors.services import SensorTableService
from apps.sensors.schemas import get_computed_columns, get_regular_columns
from apps.sensors.compute import compute_field_values
from apps.experiments.models import Experiment
from .authentication import SensorApiKeyAuthentication
from .serializers import IngestRequestSerializer, IngestResponseSerializer

logger = logging.getLogger(__name__)


class IsSensorAuthenticated(BasePermission):
    """
    Permission class that requires sensor API key authentication.
    """
    
    def has_permission(self, request, view):
        return hasattr(request, 'sensor') and request.sensor is not None


class IngestView(APIView):
    """
    Endpoint for sensors to submit data readings.
    
    Authentication: Api-Key header
    
    POST /api/ingest/
    {
        "experiment_id": "optional-uuid",
        "readings": [
            {"timestamp": "2025-01-01T00:00:00Z", "temp_c": 23.5, "relative_humidity": 45.2},
            {"timestamp": "2025-01-01T00:01:00Z", "temp_c": 23.6, "relative_humidity": 45.1}
        ]
    }
    """
    
    authentication_classes = [SensorApiKeyAuthentication]
    permission_classes = [IsSensorAuthenticated]
    
    # Throttling can be added here for rate limiting
    # throttle_classes = [SensorRateThrottle]
    
    def post(self, request):
        serializer = IngestRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        sensor = request.sensor  # Set by authentication
        
        # Validate experiment if provided
        experiment_id = data.get('experiment_id')
        if experiment_id:
            try:
                Experiment.objects.get(id=experiment_id)
            except Experiment.DoesNotExist:
                return Response(
                    {'error': 'Experiment not found.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        readings = data.get('readings', [])
        
        # Get schema information - separate regular and computed columns
        regular_columns = get_regular_columns(sensor.column_schema)
        computed_columns = get_computed_columns(sensor.column_schema)
        
        # Validate readings against sensor schema
        valid_readings = []
        all_compute_errors = []
        
        for reading in readings:
            # Extract only the regular columns defined in the schema (plus timestamp)
            clean_reading = {}
            
            # Handle timestamp
            if 'timestamp' in reading:
                clean_reading['timestamp'] = reading['timestamp']
            
            # Handle regular (non-computed) schema columns
            for col in regular_columns.keys():
                if col in reading:
                    clean_reading[col] = reading[col]
            
            # Compute values for computed columns
            if computed_columns:
                computed_values, compute_errors = compute_field_values(
                    sensor=sensor,
                    reading=clean_reading,
                    computed_columns=computed_columns
                )
                # Add computed values to the reading
                clean_reading.update(computed_values)
                # Collect errors for logging
                all_compute_errors.extend(compute_errors)
            
            valid_readings.append(clean_reading)
        
        # Log any computation errors
        if all_compute_errors:
            for error in all_compute_errors:
                try:
                    ComputedFieldError.objects.create(
                        sensor=sensor,
                        field_name=error['field_name'],
                        error_type=error['error_type'],
                        error_message=error['error_message'],
                        input_data=error['input_data'],
                    )
                except Exception as e:
                    logger.error(f"Failed to log compute error: {e}")
        
        # Insert readings
        try:
            if len(valid_readings) == 1:
                SensorTableService.insert_reading(
                    sensor=sensor,
                    data=valid_readings[0],
                    experiment_id=experiment_id
                )
                count = 1
            else:
                count = SensorTableService.insert_readings_batch(
                    sensor=sensor,
                    readings=valid_readings,
                    experiment_id=experiment_id
                )
            
            logger.info(f"Ingested {count} readings for sensor {sensor.id}")
            
            response_data = {
                'success': True,
                'sensor_id': sensor.id,
                'readings_accepted': count,
                'message': f'Successfully ingested {count} reading(s).'
            }
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Ingest error for sensor {sensor.id}: {e}")
            return Response(
                {'error': 'Failed to ingest readings.', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class IngestStatusView(APIView):
    """
    Check if the ingest endpoint is available and the sensor is authenticated.
    Useful for sensors to verify their API key is working.
    
    GET /api/ingest/status/
    """
    
    authentication_classes = [SensorApiKeyAuthentication]
    permission_classes = [IsSensorAuthenticated]
    
    def get(self, request):
        sensor = request.sensor
        regular_columns = get_regular_columns(sensor.column_schema)
        computed_columns = get_computed_columns(sensor.column_schema)
        
        return Response({
            'status': 'ok',
            'sensor_id': sensor.id,
            'sensor_name': sensor.name,
            'sensor_type': sensor.sensor_type,
            'expected_columns': list(regular_columns.keys()),
            'computed_columns': list(computed_columns.keys()),
        })
