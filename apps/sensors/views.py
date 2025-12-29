from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.experiments.models import Experiment
from .models import Sensor, SensorApiKey, ComputedFieldError
from .schemas import ALLOWED_COLUMN_TYPES, get_computed_columns
from .serializers import (
    SensorSerializer, SensorCreateSerializer, SensorUpdateSerializer,
    SensorApiKeySerializer, SensorApiKeyCreateSerializer, SensorApiKeyResponseSerializer,
    ComputedFieldErrorSerializer, SensorConfigImportSerializer,
)
from .services import create_sensor, SensorTableService, export_sensor_config, import_sensor_config


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
        computed_columns = get_computed_columns(sensor.column_schema)
        return Response({
            'table_name': sensor.table_name,
            'columns': columns,
            'defined_columns': sensor.column_schema,
            'computed_columns': list(computed_columns.keys()),
        })
    
    @action(detail=True, methods=['get'])
    def compute_errors(self, request, pk=None):
        """List computed field errors for a sensor."""
        sensor = self.get_object()
        
        # Support pagination
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))
        
        errors = sensor.computed_field_errors.all()[offset:offset + limit]
        total_count = sensor.computed_field_errors.count()
        
        serializer = ComputedFieldErrorSerializer(errors, many=True)
        return Response({
            'count': total_count,
            'results': serializer.data,
        })
    
    @action(detail=True, methods=['delete'])
    def clear_compute_errors(self, request, pk=None):
        """Clear all computed field errors for a sensor."""
        sensor = self.get_object()
        deleted_count = sensor.computed_field_errors.all().delete()[0]
        return Response({
            'detail': f'Deleted {deleted_count} error(s).',
            'deleted_count': deleted_count,
        })
    
    @action(detail=True, methods=['patch'])
    def update_compute_functions(self, request, pk=None):
        """
        Update compute functions for computed fields.
        
        Request body should be a dict mapping field names to their new compute functions:
        {
            "field_name": "def compute(data):\n    return data['x'] * 2"
        }
        
        Only existing computed fields can be updated. Cannot add new fields or change field types.
        """
        from .schemas import validate_compute_function, get_computed_columns
        
        sensor = self.get_object()
        updates = request.data
        
        if not isinstance(updates, dict):
            return Response(
                {'error': 'Request body must be a dictionary mapping field names to compute functions.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get current computed columns
        computed_columns = get_computed_columns(sensor.column_schema)
        
        # Validate that all fields being updated are computed fields
        for field_name in updates.keys():
            if field_name not in computed_columns:
                return Response(
                    {'error': f"Field '{field_name}' is not a computed field. Only computed fields can be updated."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Validate the new compute functions
        errors = {}
        for field_name, new_function in updates.items():
            is_valid, error_msg = validate_compute_function(new_function)
            if not is_valid:
                errors[field_name] = error_msg
        
        if errors:
            return Response({'errors': errors}, status=status.HTTP_400_BAD_REQUEST)
        
        # Update the schema with new compute functions
        updated_schema = sensor.column_schema.copy()
        for field_name, new_function in updates.items():
            # Update the compute_function in the schema
            updated_schema[field_name]['compute_function'] = new_function
        
        # Save the updated schema
        sensor.column_schema = updated_schema
        sensor.save(update_fields=['column_schema', 'updated_at'])
        
        return Response({
            'detail': f'Updated {len(updates)} compute function(s).',
            'updated_fields': list(updates.keys()),
            'column_schema': sensor.column_schema,
        })
    
    @action(detail=True, methods=['get'])
    def api_keys(self, request, pk=None):
        """List all API keys for a sensor."""
        sensor = self.get_object()
        keys = sensor.api_keys.all()
        serializer = SensorApiKeySerializer(keys, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def export_config(self, request, pk=None):
        """
        Export this sensor's configuration as JSON.
        
        The exported configuration can be saved and later imported to create
        a new sensor with the same schema, computed fields, and settings.
        
        Response includes:
        - config_format_version: Version of the export format
        - sensor: Sensor configuration including name, type, description, 
          metadata, and full column_schema with computed fields
        
        Does NOT include:
        - Sensor ID, table_name (generated on import)
        - API keys (security-sensitive)
        - Statistics (reading_count, last_reading_at)
        - User/timestamp information
        - Experiment association (can be set on import)
        """
        sensor = self.get_object()
        config = export_sensor_config(sensor)
        return Response(config)


class SensorImportView(APIView):
    """
    Import a sensor configuration to create a new sensor.
    
    POST /api/sensors/import/
    
    Request body:
    {
        "config": { ... exported config ... },
        "name_override": "Optional new name",
        "experiment": "optional-experiment-uuid"
    }
    """
    
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = SensorConfigImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        
        # Get experiment if provided
        experiment = None
        if data.get('experiment'):
            experiment = Experiment.objects.get(id=data['experiment'])
        
        # Import the sensor
        try:
            sensor = import_sensor_config(
                config=data['config'],
                created_by=request.user,
                experiment=experiment,
                name_override=data.get('name_override') or None,
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Return the created sensor
        response_serializer = SensorSerializer(sensor)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


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
