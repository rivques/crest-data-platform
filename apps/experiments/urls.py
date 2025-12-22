from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ExperimentViewSet, DocumentViewSet

router = DefaultRouter()
router.register(r'', ExperimentViewSet, basename='experiment')
router.register(r'documents', DocumentViewSet, basename='document')

urlpatterns = [
    path('', include(router.urls)),
]
