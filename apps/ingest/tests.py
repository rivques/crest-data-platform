"""
Tests for the ingest app - sensor data ingestion via API key authentication.
"""

import pytest
from django.urls import reverse
from django.db import connection
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from apps.experiments.models import Experiment
from apps.sensors.models import Sensor, SensorApiKey
from apps.sensors.services import SensorTableService, create_sensor


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123',
    )


@pytest.fixture
def experiment(user):
    return Experiment.objects.create(
        name='Test Experiment',
        created_by=user,
    )


@pytest.fixture
def sensor(user):
    """Create a test sensor."""
    sensor = create_sensor(
        name='Ingest Test Sensor',
        sensor_type='airquality',
        column_schema={
            'temp_c': 'DOUBLE PRECISION',
            'relative_humidity': 'DOUBLE PRECISION',
            'co2_ppm': 'DOUBLE PRECISION',
            'pm2_5': 'DOUBLE PRECISION',
            'pm10': 'DOUBLE PRECISION',
        },
        created_by=user,
    )
    yield sensor
    try:
        SensorTableService.drop_sensor_table(sensor.table_name)
    except Exception:
        pass


@pytest.fixture
def api_key(sensor, user):
    """Create an API key for the sensor."""
    raw_key = SensorApiKey.generate_key()
    api_key_obj = SensorApiKey.objects.create(
        sensor=sensor,
        name='Ingest Test Key',
        key_hash=SensorApiKey.hash_key(raw_key),
        key_prefix=raw_key[:8],
        created_by=user,
    )
    api_key_obj.raw_key = raw_key
    return api_key_obj


@pytest.fixture
def expired_api_key(sensor, user):
    """Create an expired API key."""
    raw_key = SensorApiKey.generate_key()
    api_key_obj = SensorApiKey.objects.create(
        sensor=sensor,
        name='Expired Key',
        key_hash=SensorApiKey.hash_key(raw_key),
        key_prefix=raw_key[:8],
        created_by=user,
        expires_at=timezone.now() - timezone.timedelta(days=1),  # Expired yesterday
    )
    api_key_obj.raw_key = raw_key
    return api_key_obj


@pytest.fixture
def inactive_api_key(sensor, user):
    """Create an inactive (revoked) API key."""
    raw_key = SensorApiKey.generate_key()
    api_key_obj = SensorApiKey.objects.create(
        sensor=sensor,
        name='Inactive Key',
        key_hash=SensorApiKey.hash_key(raw_key),
        key_prefix=raw_key[:8],
        created_by=user,
        is_active=False,
    )
    api_key_obj.raw_key = raw_key
    return api_key_obj


@pytest.fixture
def sensor_client(api_client, api_key):
    """API client authenticated with sensor API key."""
    api_client.credentials(HTTP_AUTHORIZATION=f'Api-Key {api_key.raw_key}')
    return api_client


@pytest.mark.django_db
class TestSensorApiKeyAuthentication:
    """Tests for the sensor API key authentication."""
    
    def test_valid_api_key_auth(self, api_client, api_key):
        """Test that valid API key authenticates successfully."""
        api_client.credentials(HTTP_AUTHORIZATION=f'Api-Key {api_key.raw_key}')
        data = {
            'readings': [
                {'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0}
            ]
        }
        response = api_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
    
    def test_invalid_api_key(self, api_client):
        """Test that invalid API key is rejected."""
        api_client.credentials(HTTP_AUTHORIZATION='Api-Key invalid-key-12345')
        data = {'readings': [{'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0}]}
        response = api_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        # Invalid key should be rejected with 401 or 403
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
    
    def test_missing_api_key(self, api_client):
        """Test that missing API key is rejected."""
        data = {'readings': [{'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0}]}
        response = api_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_expired_api_key(self, api_client, expired_api_key):
        """Test that expired API key is rejected."""
        api_client.credentials(HTTP_AUTHORIZATION=f'Api-Key {expired_api_key.raw_key}')
        data = {'readings': [{'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0}]}
        response = api_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        # Should be rejected with 401 or 403
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
    
    def test_revoked_api_key(self, api_client, inactive_api_key):
        """Test that revoked/inactive API key is rejected."""
        api_client.credentials(HTTP_AUTHORIZATION=f'Api-Key {inactive_api_key.raw_key}')
        data = {'readings': [{'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0}]}
        response = api_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        # Should be rejected with 401 or 403
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
    
    def test_wrong_auth_scheme(self, api_client, api_key):
        """Test that wrong auth scheme is rejected."""
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {api_key.raw_key}')
        data = {'readings': [{'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0}]}
        response = api_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        # Should fall through to "no credentials" since scheme doesn't match
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_api_key_last_used_updated(self, api_client, api_key):
        """Test that API key last_used_at is updated on use."""
        assert api_key.last_used_at is None
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Api-Key {api_key.raw_key}')
        data = {'readings': [{'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0}]}
        api_client.post(reverse('ingest'), data, format='json')
        
        api_key.refresh_from_db()
        assert api_key.last_used_at is not None


@pytest.mark.django_db
class TestIngestEndpoint:
    """Tests for the data ingestion endpoint."""
    
    def test_ingest_single_reading(self, sensor_client, sensor):
        """Test ingesting a single reading."""
        data = {
            'readings': [
                {
                    'timestamp': '2025-01-01T00:00:00Z',
                    'temp_c': 22.5,
                    'relative_humidity': 45.0,
                    'co2_ppm': 420,
                }
            ]
        }
        response = sensor_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['success']
        assert response.data['readings_accepted'] == 1
        
        # Verify data in table
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT temp_c, co2_ppm FROM {sensor.table_name}")
            row = cursor.fetchone()
            assert row[0] == 22.5
            assert row[1] == 420
    
    def test_ingest_multiple_readings(self, sensor_client, sensor):
        """Test ingesting multiple readings in one request."""
        data = {
            'readings': [
                {'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0, 'co2_ppm': 400},
                {'timestamp': '2025-01-01T00:01:00Z', 'temp_c': 22.5, 'co2_ppm': 410},
                {'timestamp': '2025-01-01T00:02:00Z', 'temp_c': 23.0, 'co2_ppm': 420},
            ]
        }
        response = sensor_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['readings_accepted'] == 3
        
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT COUNT(*) FROM {sensor.table_name}")
            assert cursor.fetchone()[0] == 3
    
    def test_ingest_with_experiment(self, sensor_client, sensor, experiment):
        """Test ingesting data with experiment association."""
        data = {
            'experiment_id': str(experiment.id),
            'readings': [
                {'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0}
            ]
        }
        response = sensor_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
        
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT experiment_id FROM {sensor.table_name}")
            row = cursor.fetchone()
            assert str(row[0]) == str(experiment.id)
    
    def test_ingest_invalid_experiment(self, sensor_client):
        """Test ingesting with non-existent experiment fails."""
        import uuid
        data = {
            'experiment_id': str(uuid.uuid4()),
            'readings': [
                {'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0}
            ]
        }
        response = sensor_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Experiment not found' in response.data['error']
    
    def test_ingest_empty_readings(self, sensor_client):
        """Test ingesting with no readings."""
        data = {'readings': []}
        response = sensor_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        # May succeed with 0 or reject empty - both are acceptable
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST]
    
    def test_ingest_missing_readings(self, sensor_client):
        """Test ingesting with missing readings field."""
        data = {}
        response = sensor_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_ingest_extra_fields_ignored(self, sensor_client, sensor):
        """Test that extra fields not in schema are ignored."""
        data = {
            'readings': [
                {
                    'timestamp': '2025-01-01T00:00:00Z',
                    'temp_c': 22.0,
                    'unknown_field': 'should be ignored',
                    'another_unknown': 123,
                }
            ]
        }
        response = sensor_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
    
    def test_ingest_partial_fields(self, sensor_client, sensor):
        """Test ingesting with only some schema fields."""
        data = {
            'readings': [
                {
                    'timestamp': '2025-01-01T00:00:00Z',
                    'temp_c': 22.0,
                    # Missing: relative_humidity, co2_ppm, pm2_5, pm10
                }
            ]
        }
        response = sensor_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
        
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT temp_c, relative_humidity FROM {sensor.table_name}")
            row = cursor.fetchone()
            assert row[0] == 22.0
            assert row[1] is None  # Should be NULL
    
    def test_ingest_updates_sensor_stats(self, sensor_client, sensor):
        """Test that sensor reading count and last_reading_at are updated."""
        initial_count = sensor.reading_count
        
        data = {
            'readings': [
                {'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0},
                {'timestamp': '2025-01-01T00:01:00Z', 'temp_c': 22.5},
            ]
        }
        sensor_client.post(reverse('ingest'), data, format='json')
        
        sensor.refresh_from_db()
        assert sensor.reading_count == initial_count + 2
        assert sensor.last_reading_at is not None


@pytest.mark.django_db
class TestIngestWithInactiveSensor:
    """Tests for ingestion when sensor is inactive."""
    
    def test_ingest_inactive_sensor_rejected(self, api_client, sensor, api_key, user):
        """Test that ingestion to inactive sensor is rejected."""
        # Deactivate the sensor
        sensor.is_active = False
        sensor.save()
        
        api_client.credentials(HTTP_AUTHORIZATION=f'Api-Key {api_key.raw_key}')
        data = {
            'readings': [
                {'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0}
            ]
        }
        response = api_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        # Should be rejected with 401 or 403
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


# ============================================================================
# Tests for Ingestion with Computed Fields
# ============================================================================

from apps.sensors.models import ComputedFieldError


@pytest.fixture
def computed_sensor(user):
    """Create a sensor with computed fields for ingest tests."""
    sensor = create_sensor(
        name='Computed Ingest Sensor',
        sensor_type='temperature',
        column_schema={
            'temp_c': 'DOUBLE PRECISION',
            'temp_f': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["temp_c"] * 9/5 + 32',
            },
        },
        created_by=user,
    )
    yield sensor
    try:
        SensorTableService.drop_sensor_table(sensor.table_name)
    except Exception:
        pass


@pytest.fixture
def computed_api_key(computed_sensor, user):
    """Create an API key for the computed sensor."""
    raw_key = SensorApiKey.generate_key()
    api_key_obj = SensorApiKey.objects.create(
        sensor=computed_sensor,
        name='Computed Sensor Key',
        key_hash=SensorApiKey.hash_key(raw_key),
        key_prefix=raw_key[:8],
        created_by=user,
    )
    api_key_obj.raw_key = raw_key
    return api_key_obj


@pytest.fixture
def computed_sensor_client(api_client, computed_api_key):
    """Return API client authenticated for the computed sensor."""
    api_client.credentials(HTTP_AUTHORIZATION=f'Api-Key {computed_api_key.raw_key}')
    return api_client


@pytest.mark.django_db
class TestIngestWithComputedFields:
    """Tests for data ingestion with computed fields."""
    
    def test_ingest_computes_field_value(self, computed_sensor_client, computed_sensor):
        """Test that computed fields are calculated on ingest."""
        data = {
            'readings': [
                {'timestamp': '2025-01-01T12:00:00Z', 'temp_c': 0}
            ]
        }
        
        response = computed_sensor_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        
        # Check that temp_f was computed (0°C = 32°F)
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT temp_c, temp_f FROM {computed_sensor.table_name}")
            row = cursor.fetchone()
            assert row[0] == 0.0  # temp_c
            assert row[1] == 32.0  # temp_f (computed)
    
    def test_ingest_computes_multiple_readings(self, computed_sensor_client, computed_sensor):
        """Test that computed fields work with batch ingestion."""
        data = {
            'readings': [
                {'timestamp': '2025-01-01T12:00:00Z', 'temp_c': 0},
                {'timestamp': '2025-01-01T12:01:00Z', 'temp_c': 100},
                {'timestamp': '2025-01-01T12:02:00Z', 'temp_c': -40},  # -40 is the same in C and F!
            ]
        }
        
        response = computed_sensor_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['readings_accepted'] == 3
        
        # Check computed values
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT temp_c, temp_f FROM {computed_sensor.table_name} ORDER BY timestamp")
            rows = cursor.fetchall()
            assert rows[0] == (0.0, 32.0)
            assert rows[1] == (100.0, 212.0)
            assert rows[2] == (-40.0, -40.0)
    
    def test_ingest_status_shows_computed_columns(self, computed_sensor_client, computed_sensor):
        """Test that status endpoint shows which columns are computed."""
        response = computed_sensor_client.get(reverse('ingest-status'))
        
        assert response.status_code == status.HTTP_200_OK
        assert 'temp_c' in response.data['expected_columns']
        assert 'temp_f' in response.data['computed_columns']
        assert 'temp_f' not in response.data['expected_columns']  # Computed fields not expected from sensor


@pytest.fixture
def failing_compute_sensor(user):
    """Create a sensor with a compute function that will fail."""
    sensor = create_sensor(
        name='Failing Compute Sensor',
        sensor_type='test',
        column_schema={
            'value': 'DOUBLE PRECISION',
            'bad_computed': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["missing_key"]',
            },
        },
        created_by=user,
    )
    yield sensor
    try:
        SensorTableService.drop_sensor_table(sensor.table_name)
    except Exception:
        pass


@pytest.fixture
def failing_api_key(failing_compute_sensor, user):
    """Create an API key for the failing compute sensor."""
    raw_key = SensorApiKey.generate_key()
    api_key_obj = SensorApiKey.objects.create(
        sensor=failing_compute_sensor,
        name='Failing Sensor Key',
        key_hash=SensorApiKey.hash_key(raw_key),
        key_prefix=raw_key[:8],
        created_by=user,
    )
    api_key_obj.raw_key = raw_key
    return api_key_obj


@pytest.fixture
def failing_sensor_client(api_client, failing_api_key):
    """Return API client authenticated for the failing compute sensor."""
    api_client.credentials(HTTP_AUTHORIZATION=f'Api-Key {failing_api_key.raw_key}')
    return api_client


@pytest.mark.django_db
class TestIngestComputeErrors:
    """Tests for error handling in computed fields during ingestion."""
    
    def test_ingest_logs_compute_errors(self, failing_sensor_client, failing_compute_sensor):
        """Test that compute errors are logged to the error table."""
        data = {
            'readings': [
                {'timestamp': '2025-01-01T12:00:00Z', 'value': 42}
            ]
        }
        
        # Should still succeed (data is stored, error is logged)
        response = failing_sensor_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        
        # Check that error was logged
        errors = ComputedFieldError.objects.filter(sensor=failing_compute_sensor)
        assert errors.count() == 1
        
        error = errors.first()
        assert error.field_name == 'bad_computed'
        assert 'KeyError' in error.error_type or 'Execution' in error.error_type
    
    def test_ingest_stores_null_on_compute_error(self, failing_sensor_client, failing_compute_sensor):
        """Test that computed field is NULL when computation fails."""
        data = {
            'readings': [
                {'timestamp': '2025-01-01T12:00:00Z', 'value': 42}
            ]
        }
        
        failing_sensor_client.post(
            reverse('ingest'),
            data,
            format='json'
        )
        
        # Check that regular value is stored but computed is NULL
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT value, bad_computed FROM {failing_compute_sensor.table_name}")
            row = cursor.fetchone()
            assert row[0] == 42.0  # Regular value stored
            assert row[1] is None  # Computed value is NULL due to error
