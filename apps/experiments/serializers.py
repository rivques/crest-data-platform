from rest_framework import serializers
from .models import Experiment, Document


class ExperimentSerializer(serializers.ModelSerializer):
    """Serializer for experiment details."""
    
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    sensor_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Experiment
        fields = [
            'id', 'name', 'description', 'metadata', 
            'created_by', 'created_by_username', 
            'created_at', 'updated_at', 'is_active',
            'sensor_count'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
    
    def get_sensor_count(self, obj):
        return obj.sensors.count() if hasattr(obj, 'sensors') else 0


class ExperimentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating experiments."""
    
    class Meta:
        model = Experiment
        fields = ['name', 'description', 'metadata']
    
    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class DocumentSerializer(serializers.ModelSerializer):
    """Serializer for document details."""
    
    uploaded_by_username = serializers.CharField(source='uploaded_by.username', read_only=True)
    
    class Meta:
        model = Document
        fields = [
            'id', 'experiment', 'filename', 'file_path', 
            'file_size', 'mime_type', 
            'uploaded_by', 'uploaded_by_username', 'uploaded_at'
        ]
        read_only_fields = ['id', 'uploaded_by', 'uploaded_at']
