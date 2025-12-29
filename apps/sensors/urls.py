from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import SensorViewSet, SensorApiKeyViewSet, ColumnTypesView, SensorImportView

router = DefaultRouter()
router.register(r'sensors', SensorViewSet, basename='sensor')
router.register(r'api-keys', SensorApiKeyViewSet, basename='api-key')

urlpatterns = [
    path('column-types/', ColumnTypesView.as_view(), name='column-types'),
    path('sensors/import/', SensorImportView.as_view(), name='sensor-import'),
    path('', include(router.urls)),
]
