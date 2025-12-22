import uuid
from django.db import models
from django.conf import settings


class Experiment(models.Model):
    """
    Represents a scientific experiment in the CREST Lab.
    Experiments can have multiple sensors and documents associated with them.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True, help_text="Flexible metadata for experiment-specific data")
    
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='experiments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'experiments'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.name


class Document(models.Model):
    """
    Represents a document/file associated with an experiment.
    Files are stored on disk; this model tracks metadata.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    experiment = models.ForeignKey(
        Experiment,
        on_delete=models.CASCADE,
        related_name='documents',
        null=True,
        blank=True
    )
    
    filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500, help_text="Relative path to file on disk")
    file_size = models.BigIntegerField(help_text="File size in bytes")
    mime_type = models.CharField(max_length=100, blank=True)
    
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_documents'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'documents'
        ordering = ['-uploaded_at']
    
    def __str__(self):
        return self.filename
