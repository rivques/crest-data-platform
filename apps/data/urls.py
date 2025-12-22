from django.urls import path

from .views import SensorDataView, SensorLatestView, SensorAggregateView, SensorStatsView

urlpatterns = [
    path('<uuid:sensor_id>/', SensorDataView.as_view(), name='sensor-data'),
    path('<uuid:sensor_id>/latest/', SensorLatestView.as_view(), name='sensor-latest'),
    path('<uuid:sensor_id>/aggregate/', SensorAggregateView.as_view(), name='sensor-aggregate'),
    path('<uuid:sensor_id>/stats/', SensorStatsView.as_view(), name='sensor-stats'),
]
