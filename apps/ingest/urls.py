from django.urls import path

from .views import IngestView, IngestStatusView

urlpatterns = [
    path('', IngestView.as_view(), name='ingest'),
    path('status/', IngestStatusView.as_view(), name='ingest-status'),
]
