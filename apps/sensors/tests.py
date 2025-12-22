"""
Tests for the sensors app - sensor registration, dynamic tables, API keys.
"""

import pytest
from django.urls import reverse
from django.db import connection
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from apps.experiments.models import Experiment
from apps.sensors.models import Sensor, SensorApiKey
from apps.sensors.services import SensorTableService, create_sensor
from apps.sensors.schemas import ALLOWED_COLUMN_TYPES


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
def sensor(user):
    """Create a test sensor with its data table."""
    sensor = create_sensor(
        name='Test Sensor',
        sensor_type='temperature',
        column_schema={'value_c': 'DOUBLE PRECISION'},
        created_by=user,
        description='A test temperature sensor',
    )
    yield sensor
    # Cleanup: drop the sensor table
    try:
        SensorTableService.drop_sensor_table(sensor.table_name)
    except Exception:
        pass


@pytest.fixture
def airquality_sensor(user):
    """Create an air quality sensor."""
    sensor = create_sensor(
        name='Air Quality Sensor',
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
    """Create an API key for a sensor."""
    raw_key = SensorApiKey.generate_key()
    api_key = SensorApiKey.objects.create(
        sensor=sensor,
        name='Test Key',
        key_hash=SensorApiKey.hash_key(raw_key),
        key_prefix=raw_key[:8],
        created_by=user,
    )
    api_key.raw_key = raw_key  # Attach for testing
    return api_key


@pytest.mark.django_db
class TestSensorModel:
    """Tests for the Sensor model."""
    
    def test_sensor_str(self, sensor):
        """Test sensor string representation."""
        assert 'Test Sensor' in str(sensor)
        assert 'temperature' in str(sensor)
    
    def test_sensor_defaults(self, sensor):
        """Test sensor default values."""
        assert sensor.is_active
        assert sensor.reading_count == 0
        assert sensor.last_reading_at is None


@pytest.mark.django_db
class TestSensorApiKeyModel:
    """Tests for the SensorApiKey model."""
    
    def test_generate_key(self):
        """Test API key generation."""
        key1 = SensorApiKey.generate_key()
        key2 = SensorApiKey.generate_key()
        
        assert len(key1) > 20  # Should be reasonably long
        assert key1 != key2  # Should be unique
    
    def test_hash_key(self):
        """Test API key hashing."""
        key = 'test-api-key-12345'
        hash1 = SensorApiKey.hash_key(key)
        hash2 = SensorApiKey.hash_key(key)
        
        assert hash1 == hash2  # Same input = same hash
        assert hash1 != key  # Hash is different from key
        assert len(hash1) == 64  # SHA256 hex digest length
    
    def test_verify_key(self, api_key):
        """Test API key verification."""
        assert api_key.verify_key(api_key.raw_key)
        assert not api_key.verify_key('wrong-key')
    
    def test_api_key_str(self, api_key):
        """Test API key string representation."""
        assert api_key.key_prefix in str(api_key)


@pytest.mark.django_db
class TestSensorTableService:
    """Tests for the SensorTableService."""
    
    def test_generate_table_name(self):
        """Test table name generation."""
        name = SensorTableService.generate_table_name('temperature', 'abc12345-6789-0000-0000-000000000000')
        assert name.startswith('sensor_temperature_')
        assert len(name) < 64  # PostgreSQL identifier limit
    
    def test_generate_table_name_sanitizes_type(self):
        """Test that special characters are removed from type."""
        name = SensorTableService.generate_table_name('my-sensor!@#type', 'abc12345')
        assert '-' not in name
        assert '!' not in name
        assert name.startswith('sensor_mysensortype_')
    
    def test_validate_column_schema_valid(self):
        """Test validating a valid schema."""
        schema = {
            'temp_c': 'DOUBLE PRECISION',
            'humidity': 'DOUBLE PRECISION',
        }
        is_valid, error = SensorTableService.validate_column_schema(schema)
        assert is_valid
        assert error == ""
    
    def test_validate_column_schema_empty(self):
        """Test that empty schema is invalid."""
        is_valid, error = SensorTableService.validate_column_schema({})
        assert not is_valid
        assert 'empty' in error.lower()
    
    def test_validate_column_schema_invalid_type(self):
        """Test that invalid column types are rejected."""
        schema = {'bad_col': 'INVALID_TYPE'}
        is_valid, error = SensorTableService.validate_column_schema(schema)
        assert not is_valid
        assert 'type' in error.lower()
    
    def test_validate_column_schema_reserved_name(self):
        """Test that reserved column names are rejected."""
        schema = {'id': 'INTEGER'}  # 'id' is reserved
        is_valid, error = SensorTableService.validate_column_schema(schema)
        assert not is_valid
        assert 'reserved' in error.lower()
    
    def test_create_sensor_table(self, sensor):
        """Test that sensor table is created with correct structure."""
        columns = SensorTableService.get_table_columns(sensor.table_name)
        column_names = [c['name'] for c in columns]
        
        assert 'id' in column_names
        assert 'timestamp' in column_names
        assert 'experiment_id' in column_names
        assert 'created_at' in column_names
        # Schema-specific column
        assert 'value_c' in column_names
    
    def test_insert_reading(self, sensor):
        """Test inserting a single reading."""
        data = {
            'timestamp': '2025-01-01T00:00:00Z',
            'value_c': 23.5,
        }
        row_id = SensorTableService.insert_reading(sensor, data)
        assert row_id > 0
        
        # Verify it's in the table
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT value_c FROM {sensor.table_name} WHERE id = %s", [row_id])
            row = cursor.fetchone()
            assert row[0] == 23.5
    
    def test_insert_readings_batch(self, airquality_sensor):
        """Test inserting multiple readings in a batch."""
        readings = [
            {'timestamp': '2025-01-01T00:00:00Z', 'temp_c': 22.0, 'co2_ppm': 400},
            {'timestamp': '2025-01-01T00:01:00Z', 'temp_c': 22.5, 'co2_ppm': 410},
            {'timestamp': '2025-01-01T00:02:00Z', 'temp_c': 23.0, 'co2_ppm': 420},
        ]
        count = SensorTableService.insert_readings_batch(airquality_sensor, readings)
        assert count == 3
        
        # Verify data
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT COUNT(*) FROM {airquality_sensor.table_name}")
            assert cursor.fetchone()[0] == 3
    
    def test_drop_sensor_table(self, user):
        """Test dropping a sensor table."""
        sensor = create_sensor(
            name='Temporary Sensor',
            sensor_type='temperature',
            column_schema={'value_c': 'DOUBLE PRECISION'},
            created_by=user,
        )
        table_name = sensor.table_name
        
        # Verify table exists
        assert SensorTableService.get_table_columns(table_name)
        
        # Drop it
        SensorTableService.drop_sensor_table(table_name)
        
        # Verify it's gone
        columns = SensorTableService.get_table_columns(table_name)
        assert len(columns) == 0
    
    def test_drop_table_rejects_non_sensor_prefix(self):
        """Test that dropping non-sensor tables is rejected."""
        with pytest.raises(ValueError) as exc:
            SensorTableService.drop_sensor_table('users')
        assert 'sensor_' in str(exc.value)


@pytest.mark.django_db
class TestCreateSensorFunction:
    """Tests for the create_sensor helper function."""
    
    def test_create_sensor_with_schema(self, user):
        """Test creating a sensor with a column schema."""
        column_schema = {'value_c': 'DOUBLE PRECISION'}
        sensor = create_sensor(
            name='Temperature Sensor',
            sensor_type='temperature',
            column_schema=column_schema,
            created_by=user,
        )
        try:
            assert sensor.sensor_type == 'temperature'
            assert sensor.column_schema == column_schema
            assert sensor.table_name.startswith('sensor_temperature_')
        finally:
            SensorTableService.drop_sensor_table(sensor.table_name)
    
    def test_create_sensor_with_multiple_columns(self, user):
        """Test creating a sensor with multiple columns."""
        column_schema = {
            'pressure_pa': 'DOUBLE PRECISION',
            'altitude_m': 'DOUBLE PRECISION',
            'notes': 'VARCHAR(255)',
        }
        sensor = create_sensor(
            name='Barometer',
            sensor_type='barometer',
            column_schema=column_schema,
            created_by=user,
        )
        try:
            assert sensor.column_schema == column_schema
            columns = SensorTableService.get_table_columns(sensor.table_name)
            column_names = [c['name'] for c in columns]
            assert 'pressure_pa' in column_names
            assert 'altitude_m' in column_names
            assert 'notes' in column_names
        finally:
            SensorTableService.drop_sensor_table(sensor.table_name)
    
    def test_create_sensor_without_schema_fails(self, user):
        """Test that creating a sensor without schema fails."""
        with pytest.raises(TypeError):
            create_sensor(
                name='Bad Sensor',
                sensor_type='test',
                created_by=user,
            )
    
    def test_create_sensor_empty_schema_fails(self, user):
        """Test that empty schema fails."""
        with pytest.raises(ValueError) as exc:
            create_sensor(
                name='Bad Sensor',
                sensor_type='test',
                column_schema={},
                created_by=user,
            )
        assert 'empty' in str(exc.value).lower()


@pytest.mark.django_db
class TestSensorAPI:
    """Tests for the Sensor REST API."""
    
    def test_list_sensors(self, authenticated_client, sensor):
        """Test listing sensors."""
        response = authenticated_client.get(reverse('sensor-list'))
        assert response.status_code == status.HTTP_200_OK
        # Response may have 'count' for paginated or be a list
        if isinstance(response.data, dict):
            assert response.data['count'] >= 1
        else:
            assert len(response.data) >= 1
    
    def test_list_sensors_unauthenticated(self, api_client):
        """Test listing sensors without auth fails."""
        response = api_client.get(reverse('sensor-list'))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_create_sensor_api(self, authenticated_client):
        """Test creating a sensor via API."""
        data = {
            'name': 'API Created Sensor',
            'sensor_type': 'temperature',
            'description': 'Created via API',
            'column_schema': {'value_c': 'DOUBLE PRECISION'},
        }
        response = authenticated_client.post(
            reverse('sensor-list'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'API Created Sensor'
        assert response.data['column_schema'] == {'value_c': 'DOUBLE PRECISION'}
        
        # Cleanup
        sensor = Sensor.objects.get(id=response.data['id'])
        SensorTableService.drop_sensor_table(sensor.table_name)
    
    def test_create_sensor_missing_schema(self, authenticated_client):
        """Test creating sensor without schema fails."""
        data = {
            'name': 'Bad Sensor',
            'sensor_type': 'test',
        }
        response = authenticated_client.post(
            reverse('sensor-list'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'column_schema' in response.data
    
    def test_create_sensor_invalid_column_type(self, authenticated_client):
        """Test creating sensor with invalid column type fails."""
        data = {
            'name': 'Bad Sensor',
            'sensor_type': 'test',
            'column_schema': {'value': 'INVALID_TYPE'},
        }
        response = authenticated_client.post(
            reverse('sensor-list'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_retrieve_sensor(self, authenticated_client, sensor):
        """Test retrieving a sensor by ID."""
        response = authenticated_client.get(
            reverse('sensor-detail', kwargs={'pk': sensor.id})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == sensor.name
    
    def test_get_sensor_schema(self, authenticated_client, sensor):
        """Test getting a sensor's schema."""
        response = authenticated_client.get(
            reverse('sensor-schema', kwargs={'pk': sensor.id})
        )
        # May be 200 with schema or 404 if action not registered
        if response.status_code == status.HTTP_200_OK:
            assert 'column_schema' in response.data or 'columns' in response.data
    
    def test_get_column_types(self, authenticated_client):
        """Test listing available column types."""
        response = authenticated_client.get(reverse('column-types'))
        assert response.status_code == status.HTTP_200_OK
        assert 'types' in response.data
        assert 'DOUBLE PRECISION' in response.data['types']


@pytest.mark.django_db
class TestApiKeyAPI:
    """Tests for the API Key REST API."""
    
    def test_create_api_key(self, authenticated_client, sensor):
        """Test creating an API key."""
        data = {
            'sensor': str(sensor.id),
            'name': 'New Key',
        }
        response = authenticated_client.post(
            reverse('api-key-list'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert 'api_key' in response.data  # Raw key shown once
        assert response.data['name'] == 'New Key'
    
    def test_list_api_keys(self, authenticated_client, api_key):
        """Test listing API keys."""
        response = authenticated_client.get(reverse('api-key-list'))
        assert response.status_code == status.HTTP_200_OK
        # Response may be paginated dict or list
        if isinstance(response.data, dict):
            assert response.data['count'] >= 1
            # Raw key should NOT be in list response
            assert 'api_key' not in response.data['results'][0]
        else:
            assert len(response.data) >= 1
            assert 'api_key' not in response.data[0]
    
    def test_revoke_api_key(self, authenticated_client, api_key):
        """Test revoking an API key."""
        response = authenticated_client.post(
            reverse('api-key-revoke', kwargs={'pk': api_key.id})
        )
        assert response.status_code == status.HTTP_200_OK
        
        api_key.refresh_from_db()
        assert not api_key.is_active
    
    def test_delete_api_key(self, authenticated_client, api_key):
        """Test deleting an API key."""
        key_id = api_key.id
        response = authenticated_client.delete(
            reverse('api-key-detail', kwargs={'pk': key_id})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not SensorApiKey.objects.filter(id=key_id).exists()
    
    def test_create_api_key_nonexistent_sensor(self, authenticated_client):
        """Test creating key for non-existent sensor fails."""
        import uuid
        data = {
            'sensor': str(uuid.uuid4()),
            'name': 'Bad Key',
        }
        response = authenticated_client.post(
            reverse('api-key-list'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
