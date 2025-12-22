"""
URL configuration for CREST Data Platform.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/experiments/', include('apps.experiments.urls')),
    path('api/', include('apps.sensors.urls')),  # Includes sensors/ and api-keys/ prefixes
    path('api/ingest/', include('apps.ingest.urls')),
    path('api/data/', include('apps.data.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
