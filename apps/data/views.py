from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.sensors.models import Sensor
from .services import DataQueryService
from .serializers import DataQueryParamsSerializer, AggregationParamsSerializer


class SensorDataView(APIView):
    """
    Query data from a specific sensor.
    
    GET /api/data/{sensor_id}/
    
    Query params:
    - start_time: ISO datetime
    - end_time: ISO datetime
    - experiment_id: UUID
    - limit: int (default 1000, max 10000)
    - offset: int
    - order_by: column name (default 'timestamp')
    - order_dir: 'asc' or 'desc'
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request, sensor_id):
        # Get sensor
        try:
            sensor = Sensor.objects.get(id=sensor_id)
        except Sensor.DoesNotExist:
            return Response(
                {'error': 'Sensor not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Validate query params
        serializer = DataQueryParamsSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        params = serializer.validated_data
        
        # Query data
        try:
            rows, total_count = DataQueryService.query_sensor_data(
                table_name=sensor.table_name,
                start_time=params.get('start_time'),
                end_time=params.get('end_time'),
                experiment_id=str(params['experiment_id']) if params.get('experiment_id') else None,
                limit=params.get('limit', 1000),
                offset=params.get('offset', 0),
                order_by=params.get('order_by', 'timestamp'),
                order_dir=params.get('order_dir', 'desc'),
            )
        except Exception as e:
            return Response(
                {'error': 'Query failed.', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response({
            'sensor_id': sensor.id,
            'sensor_name': sensor.name,
            'table_name': sensor.table_name,
            'total_count': total_count,
            'returned_count': len(rows),
            'data': rows,
        })


class SensorLatestView(APIView):
    """
    Get the latest reading from a sensor.
    
    GET /api/data/{sensor_id}/latest/
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request, sensor_id):
        try:
            sensor = Sensor.objects.get(id=sensor_id)
        except Sensor.DoesNotExist:
            return Response(
                {'error': 'Sensor not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        reading = DataQueryService.get_latest_reading(sensor.table_name)
        
        return Response({
            'sensor_id': sensor.id,
            'sensor_name': sensor.name,
            'reading': reading,
        })


class SensorAggregateView(APIView):
    """
    Get aggregated data from a sensor.
    
    GET /api/data/{sensor_id}/aggregate/
    
    Query params:
    - column: column name to aggregate (required)
    - aggregation: 'avg', 'min', 'max', 'sum', 'count' (default 'avg')
    - interval: '1 minute', '5 minutes', '15 minutes', '1 hour', '1 day'
    - start_time: ISO datetime
    - end_time: ISO datetime
    - experiment_id: UUID
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request, sensor_id):
        try:
            sensor = Sensor.objects.get(id=sensor_id)
        except Sensor.DoesNotExist:
            return Response(
                {'error': 'Sensor not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Validate params
        serializer = AggregationParamsSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        params = serializer.validated_data
        
        # Verify column exists in schema
        if params['column'] not in sensor.column_schema and params['column'] != 'timestamp':
            return Response(
                {'error': f"Column '{params['column']}' not found in sensor schema."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            data = DataQueryService.get_aggregated_data(
                table_name=sensor.table_name,
                column=params['column'],
                aggregation=params.get('aggregation', 'avg'),
                interval=params.get('interval', '1 hour'),
                start_time=params.get('start_time'),
                end_time=params.get('end_time'),
                experiment_id=str(params['experiment_id']) if params.get('experiment_id') else None,
            )
        except Exception as e:
            return Response(
                {'error': 'Aggregation failed.', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response({
            'sensor_id': sensor.id,
            'sensor_name': sensor.name,
            'column': params['column'],
            'aggregation': params.get('aggregation', 'avg'),
            'interval': params.get('interval', '1 hour'),
            'data': data,
        })


class SensorStatsView(APIView):
    """
    Get statistics for a sensor column.
    
    GET /api/data/{sensor_id}/stats/?column=temp_c
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request, sensor_id):
        try:
            sensor = Sensor.objects.get(id=sensor_id)
        except Sensor.DoesNotExist:
            return Response(
                {'error': 'Sensor not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        column = request.query_params.get('column')
        if not column:
            return Response(
                {'error': 'column parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if column not in sensor.column_schema:
            return Response(
                {'error': f"Column '{column}' not found in sensor schema."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            stats = DataQueryService.get_sensor_stats(sensor.table_name, column)
        except Exception as e:
            return Response(
                {'error': 'Stats query failed.', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response({
            'sensor_id': sensor.id,
            'sensor_name': sensor.name,
            'column': column,
            'stats': stats,
        })
