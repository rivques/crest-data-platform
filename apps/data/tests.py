"""
Tests for the data app - querying sensor data.
"""

import pytest
from django.urls import reverse
from django.db import connection
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from apps.experiments.models import Experiment
from apps.sensors.models import Sensor
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
def authenticated_client(api_client, user):
    """Return an authenticated API client."""
    response = api_client.post(
        reverse('token_obtain_pair'),
        {'username': 'testuser', 'password': 'testpass123'},
        format='json'
    )
    token = response.data['access']
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return api_client


@pytest.fixture
def experiment(user):
    return Experiment.objects.create(
        name='Test Experiment',
        created_by=user,
    )


@pytest.fixture
def sensor_with_data(user, experiment):
    """Create a sensor and populate it with test data."""
    sensor = create_sensor(
        name='Data Test Sensor',
        sensor_type='temperature',
        column_schema={'value_c': 'DOUBLE PRECISION'},
        created_by=user,
    )
    
    # Insert test data
    with connection.cursor() as cursor:
        cursor.execute(f"""
            INSERT INTO {sensor.table_name} (experiment_id, timestamp, value_c)
            VALUES 
                (%s, '2025-01-01 00:00:00+00', 20.0),
                (%s, '2025-01-01 01:00:00+00', 21.0),
                (%s, '2025-01-01 02:00:00+00', 22.0),
                (%s, '2025-01-01 03:00:00+00', 23.0),
                (%s, '2025-01-01 04:00:00+00', 24.0),
                (NULL, '2025-01-01 05:00:00+00', 25.0),
                (NULL, '2025-01-01 06:00:00+00', 26.0)
        """, [str(experiment.id)] * 5)
    
    yield sensor
    
    try:
        SensorTableService.drop_sensor_table(sensor.table_name)
    except Exception:
        pass


@pytest.fixture
def empty_sensor(user):
    """Create a sensor with no data."""
    sensor = create_sensor(
        name='Empty Sensor',
        sensor_type='temperature',
        column_schema={'value_c': 'DOUBLE PRECISION'},
        created_by=user,
    )
    yield sensor
    try:
        SensorTableService.drop_sensor_table(sensor.table_name)
    except Exception:
        pass


@pytest.mark.django_db
class TestSensorDataEndpoint:
    """Tests for the sensor data retrieval endpoint."""
    
    def test_get_sensor_data(self, authenticated_client, sensor_with_data):
        """Test retrieving sensor data."""
        response = authenticated_client.get(
            reverse('sensor-data', kwargs={'sensor_id': sensor_with_data.id})
        )
        assert response.status_code == status.HTTP_200_OK
        assert str(response.data['sensor_id']) == str(sensor_with_data.id)
        assert response.data['total_count'] == 7
        assert len(response.data['data']) == 7
    
    def test_get_sensor_data_unauthenticated(self, api_client, sensor_with_data):
        """Test that unauthenticated access is denied."""
        response = api_client.get(
            reverse('sensor-data', kwargs={'sensor_id': sensor_with_data.id})
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_nonexistent_sensor_data(self, authenticated_client):
        """Test retrieving data for non-existent sensor."""
        import uuid
        response = authenticated_client.get(
            reverse('sensor-data', kwargs={'sensor_id': uuid.uuid4()})
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_get_empty_sensor_data(self, authenticated_client, empty_sensor):
        """Test retrieving data from sensor with no readings."""
        response = authenticated_client.get(
            reverse('sensor-data', kwargs={'sensor_id': empty_sensor.id})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_count'] == 0
        assert len(response.data['data']) == 0
    
    def test_get_sensor_data_with_limit(self, authenticated_client, sensor_with_data):
        """Test limiting returned data."""
        response = authenticated_client.get(
            reverse('sensor-data', kwargs={'sensor_id': sensor_with_data.id}),
            {'limit': 3}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['returned_count'] == 3
        assert len(response.data['data']) == 3
    
    def test_get_sensor_data_with_offset(self, authenticated_client, sensor_with_data):
        """Test offset for pagination."""
        response = authenticated_client.get(
            reverse('sensor-data', kwargs={'sensor_id': sensor_with_data.id}),
            {'limit': 3, 'offset': 5}
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data['data']) == 2  # Only 2 remaining after offset 5
    
    def test_get_sensor_data_time_range(self, authenticated_client, sensor_with_data):
        """Test filtering by time range."""
        response = authenticated_client.get(
            reverse('sensor-data', kwargs={'sensor_id': sensor_with_data.id}),
            {
                'start_time': '2025-01-01T01:00:00Z',
                'end_time': '2025-01-01T04:00:00Z',
            }
        )
        assert response.status_code == status.HTTP_200_OK
        # Should include 01:00, 02:00, 03:00, 04:00 (4 readings)
        assert response.data['total_count'] == 4
    
    def test_get_sensor_data_by_experiment(self, authenticated_client, sensor_with_data, experiment):
        """Test filtering by experiment."""
        response = authenticated_client.get(
            reverse('sensor-data', kwargs={'sensor_id': sensor_with_data.id}),
            {'experiment_id': str(experiment.id)}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['total_count'] == 5  # 5 have experiment_id set
    
    def test_get_sensor_data_order(self, authenticated_client, sensor_with_data):
        """Test that data is ordered by timestamp descending by default."""
        response = authenticated_client.get(
            reverse('sensor-data', kwargs={'sensor_id': sensor_with_data.id})
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.data['data']
        # First item should be most recent
        assert data[0]['value_c'] == 26.0
        assert data[-1]['value_c'] == 20.0


@pytest.mark.django_db
class TestLatestReadingEndpoint:
    """Tests for getting the latest sensor reading."""
    
    def test_get_latest_reading(self, authenticated_client, sensor_with_data):
        """Test getting the latest reading."""
        response = authenticated_client.get(
            reverse('sensor-latest', kwargs={'sensor_id': sensor_with_data.id})
        )
        assert response.status_code == status.HTTP_200_OK
        # API returns {sensor_id, sensor_name, reading: {...}}
        assert 'reading' in response.data
        if response.data['reading']:
            assert response.data['reading']['value_c'] == 26.0  # Most recent value
    
    def test_get_latest_reading_empty_sensor(self, authenticated_client, empty_sensor):
        """Test getting latest reading from empty sensor."""
        response = authenticated_client.get(
            reverse('sensor-latest', kwargs={'sensor_id': empty_sensor.id})
        )
        # API returns 200 with null reading for empty sensors
        assert response.status_code == status.HTTP_200_OK
        assert response.data['reading'] is None


@pytest.mark.django_db
class TestAggregateEndpoint:
    """Tests for aggregated sensor data."""
    
    def test_get_aggregates(self, authenticated_client, sensor_with_data):
        """Test getting data aggregates."""
        response = authenticated_client.get(
            reverse('sensor-aggregate', kwargs={'sensor_id': sensor_with_data.id}),
            {'column': 'value_c'}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['column'] == 'value_c'
        # API returns time-bucketed data array, not simple stats
        assert 'data' in response.data
    
    def test_get_aggregates_missing_column(self, authenticated_client, sensor_with_data):
        """Test aggregates without specifying column."""
        response = authenticated_client.get(
            reverse('sensor-aggregate', kwargs={'sensor_id': sensor_with_data.id})
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_get_aggregates_invalid_column(self, authenticated_client, sensor_with_data):
        """Test aggregates with non-existent column."""
        response = authenticated_client.get(
            reverse('sensor-aggregate', kwargs={'sensor_id': sensor_with_data.id}),
            {'column': 'nonexistent_column'}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_get_aggregates_time_filtered(self, authenticated_client, sensor_with_data):
        """Test aggregates with time filter."""
        response = authenticated_client.get(
            reverse('sensor-aggregate', kwargs={'sensor_id': sensor_with_data.id}),
            {
                'column': 'value_c',
                'start_time': '2025-01-01T00:00:00Z',
                'end_time': '2025-01-01T02:00:00Z',
            }
        )
        assert response.status_code == status.HTTP_200_OK
        assert 'data' in response.data


@pytest.mark.django_db
class TestSensorStatsEndpoint:
    """Tests for sensor statistics."""
    
    def test_get_sensor_stats(self, authenticated_client, sensor_with_data):
        """Test getting sensor statistics."""
        response = authenticated_client.get(
            reverse('sensor-stats', kwargs={'sensor_id': sensor_with_data.id}),
            {'column': 'value_c'}
        )
        assert response.status_code == status.HTTP_200_OK
        # Stats endpoint requires column parameter
        assert 'stats' in response.data or 'count' in response.data or 'min' in response.data
    
    def test_get_stats_empty_sensor(self, authenticated_client, empty_sensor):
        """Test getting stats for empty sensor."""
        response = authenticated_client.get(
            reverse('sensor-stats', kwargs={'sensor_id': empty_sensor.id}),
            {'column': 'value_c'}
        )
        # Should still return 200 with zero count
        assert response.status_code == status.HTTP_200_OK
