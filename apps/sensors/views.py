from rest_framework import viewsets, generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.experiments.models import Experiment
from .models import Sensor, SensorApiKey
from .schemas import ALLOWED_COLUMN_TYPES
from .serializers import (
    SensorSerializer, SensorCreateSerializer, SensorUpdateSerializer,
    SensorApiKeySerializer, SensorApiKeyCreateSerializer, SensorApiKeyResponseSerializer,
)
from .services import create_sensor, SensorTableService


class SensorViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing sensors.
    """
    
    queryset = Sensor.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return SensorCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return SensorUpdateSerializer
        return SensorSerializer
    
    def get_queryset(self):
        queryset = Sensor.objects.all()
        
        # Filter by experiment
        experiment_id = self.request.query_params.get('experiment')
        if experiment_id:
            queryset = queryset.filter(experiment_id=experiment_id)
        
        # Filter by type
        sensor_type = self.request.query_params.get('type')
        if sensor_type:
            queryset = queryset.filter(sensor_type=sensor_type)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Search by name
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(name__icontains=search)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        
        # Get experiment if provided
        experiment = None
        if data.get('experiment'):
            try:
                experiment = Experiment.objects.get(id=data['experiment'])
            except Experiment.DoesNotExist:
                return Response(
                    {'experiment': 'Experiment not found.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create sensor with table
        sensor = create_sensor(
            name=data['name'],
            sensor_type=data['sensor_type'],
            column_schema=data['column_schema'],
            created_by=request.user,
            experiment=experiment,
            description=data.get('description', ''),
            metadata=data.get('metadata', {}),
        )
        
        response_serializer = SensorSerializer(sensor)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def schema(self, request, pk=None):
        """Get the column schema for a sensor's data table."""
        sensor = self.get_object()
        columns = SensorTableService.get_table_columns(sensor.table_name)
        return Response({
            'table_name': sensor.table_name,
            'columns': columns,
            'defined_columns': sensor.column_schema,
        })
    
    @action(detail=True, methods=['get'])
    def api_keys(self, request, pk=None):
        """List all API keys for a sensor."""
        sensor = self.get_object()
        keys = sensor.api_keys.all()
        serializer = SensorApiKeySerializer(keys, many=True)
        return Response(serializer.data)


class SensorApiKeyViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing sensor API keys.
    """
    
    queryset = SensorApiKey.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return SensorApiKeyCreateSerializer
        return SensorApiKeySerializer
    
    def get_queryset(self):
        queryset = SensorApiKey.objects.all()
        
        # Filter by sensor
        sensor_id = self.request.query_params.get('sensor')
        if sensor_id:
            queryset = queryset.filter(sensor_id=sensor_id)
        
        # Filter by active
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        sensor = Sensor.objects.get(id=data['sensor'])
        
        # Create the API key
        api_key, raw_key = SensorApiKey.create_for_sensor(
            sensor=sensor,
            name=data['name'],
            created_by=request.user,
            expires_at=data.get('expires_at'),
        )
        
        # Return response with the raw key (only time it's visible)
        response_data = {
            'id': api_key.id,
            'sensor': api_key.sensor_id,
            'name': api_key.name,
            'key_prefix': api_key.key_prefix,
            'api_key': raw_key,  # Only shown at creation!
            'created_at': api_key.created_at,
            'expires_at': api_key.expires_at,
        }
        
        return Response(response_data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Revoke an API key."""
        api_key = self.get_object()
        api_key.is_active = False
        api_key.save()
        return Response({'detail': 'API key revoked successfully.'})


class ColumnTypesView(APIView):
    """List allowed column types for sensor schemas."""
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        return Response({
            'types': ALLOWED_COLUMN_TYPES,
            'description': 'PostgreSQL column types allowed when defining sensor schemas.'
        })
