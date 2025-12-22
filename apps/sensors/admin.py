from django.contrib import admin
from .models import Sensor, SensorApiKey


@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    list_display = ['name', 'sensor_type', 'experiment', 'is_active', 'reading_count', 'last_reading_at']
    list_filter = ['sensor_type', 'is_active', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'table_name', 'column_schema', 'created_at', 'updated_at', 'last_reading_at', 'reading_count']
    
    fieldsets = (
        (None, {
            'fields': ('id', 'name', 'sensor_type', 'description', 'is_active')
        }),
        ('Data Table', {
            'fields': ('table_name', 'column_schema'),
        }),
        ('Associations', {
            'fields': ('experiment', 'created_by'),
        }),
        ('Statistics', {
            'fields': ('reading_count', 'last_reading_at'),
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(SensorApiKey)
class SensorApiKeyAdmin(admin.ModelAdmin):
    list_display = ['name', 'sensor', 'key_prefix', 'is_active', 'created_at', 'last_used_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'sensor__name']
    readonly_fields = ['id', 'key_hash', 'key_prefix', 'created_at', 'last_used_at']
    
    fieldsets = (
        (None, {
            'fields': ('id', 'sensor', 'name', 'is_active')
        }),
        ('Key Info', {
            'fields': ('key_prefix', 'key_hash'),
        }),
        ('Timestamps', {
            'fields': ('created_by', 'created_at', 'last_used_at', 'expires_at'),
        }),
    )
