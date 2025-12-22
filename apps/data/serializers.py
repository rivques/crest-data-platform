from rest_framework import serializers


class DataQueryParamsSerializer(serializers.Serializer):
    """Serializer for data query parameters."""
    
    start_time = serializers.DateTimeField(required=False)
    end_time = serializers.DateTimeField(required=False)
    experiment_id = serializers.UUIDField(required=False)
    limit = serializers.IntegerField(required=False, default=1000, min_value=1, max_value=10000)
    offset = serializers.IntegerField(required=False, default=0, min_value=0)
    order_by = serializers.CharField(required=False, default='timestamp')
    order_dir = serializers.ChoiceField(required=False, choices=['asc', 'desc'], default='desc')


class AggregationParamsSerializer(serializers.Serializer):
    """Serializer for aggregation query parameters."""
    
    column = serializers.CharField()
    aggregation = serializers.ChoiceField(choices=['avg', 'min', 'max', 'sum', 'count'], default='avg')
    interval = serializers.ChoiceField(
        choices=['1 minute', '5 minutes', '15 minutes', '1 hour', '1 day'],
        default='1 hour'
    )
    start_time = serializers.DateTimeField(required=False)
    end_time = serializers.DateTimeField(required=False)
    experiment_id = serializers.UUIDField(required=False)


class DataResponseSerializer(serializers.Serializer):
    """Serializer for data query response."""
    
    sensor_id = serializers.UUIDField()
    table_name = serializers.CharField()
    total_count = serializers.IntegerField()
    returned_count = serializers.IntegerField()
    data = serializers.ListField()
