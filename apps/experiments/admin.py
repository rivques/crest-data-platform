from django.contrib import admin
from .models import Experiment, Document


@admin.register(Experiment)
class ExperimentAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_by', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = (
        (None, {
            'fields': ('id', 'name', 'description', 'is_active')
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['filename', 'experiment', 'file_size', 'uploaded_by', 'uploaded_at']
    list_filter = ['mime_type', 'uploaded_at']
    search_fields = ['filename']
    readonly_fields = ['id', 'uploaded_at']
