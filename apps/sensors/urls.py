from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import SensorViewSet, SensorApiKeyViewSet, ColumnTypesView

router = DefaultRouter()
router.register(r'sensors', SensorViewSet, basename='sensor')
router.register(r'api-keys', SensorApiKeyViewSet, basename='api-key')

urlpatterns = [
    path('column-types/', ColumnTypesView.as_view(), name='column-types'),
    path('', include(router.urls)),
]
