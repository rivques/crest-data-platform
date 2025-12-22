from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Experiment, Document
from .serializers import ExperimentSerializer, ExperimentCreateSerializer, DocumentSerializer


class ExperimentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing experiments.
    
    Provides list, create, retrieve, update, and delete actions.
    """
    
    queryset = Experiment.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return ExperimentCreateSerializer
        return ExperimentSerializer
    
    def get_queryset(self):
        queryset = Experiment.objects.all()
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Search by name
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(name__icontains=search)
        
        return queryset
    
    @action(detail=True, methods=['get'])
    def sensors(self, request, pk=None):
        """List all sensors associated with this experiment."""
        experiment = self.get_object()
        from apps.sensors.serializers import SensorSerializer
        sensors = experiment.sensors.all()
        serializer = SensorSerializer(sensors, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def documents(self, request, pk=None):
        """List all documents associated with this experiment."""
        experiment = self.get_object()
        documents = experiment.documents.all()
        serializer = DocumentSerializer(documents, many=True)
        return Response(serializer.data)


class DocumentViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing documents.
    
    Note: File upload functionality will be added later.
    """
    
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = Document.objects.all()
        
        # Filter by experiment
        experiment_id = self.request.query_params.get('experiment')
        if experiment_id:
            queryset = queryset.filter(experiment_id=experiment_id)
        
        return queryset
