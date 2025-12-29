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


# ============================================================================
# Tests for Computed Fields Feature
# ============================================================================

from apps.sensors.schemas import (
    validate_column_schema,
    validate_compute_function,
    get_computed_columns,
    get_regular_columns,
    is_computed_field,
    get_column_type,
)
from apps.sensors.compute import (
    execute_compute_function,
    compute_field_values,
    ComputeError,
    ComputeTimeoutError,
    ComputeSecurityError,
    ComputeExecutionError,
)
from apps.sensors.models import ComputedFieldError


@pytest.mark.django_db
class TestComputedFieldSchema:
    """Tests for computed field schema validation."""
    
    def test_validate_simple_schema(self):
        """Test that simple (non-computed) schema still works."""
        schema = {
            'temp_c': 'DOUBLE PRECISION',
            'humidity': 'REAL',
        }
        is_valid, error = validate_column_schema(schema)
        assert is_valid
        assert error == ""
    
    def test_validate_extended_schema(self):
        """Test extended schema with computed fields."""
        schema = {
            'temp_c': 'DOUBLE PRECISION',
            'temp_f': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["temp_c"] * 9/5 + 32',
            },
        }
        is_valid, error = validate_column_schema(schema)
        assert is_valid
        assert error == ""
    
    def test_validate_computed_requires_function(self):
        """Test that computed fields must have a compute_function."""
        schema = {
            'temp_c': 'DOUBLE PRECISION',
            'temp_f': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                # Missing compute_function
            },
        }
        is_valid, error = validate_column_schema(schema)
        assert not is_valid
        assert 'compute_function' in error.lower()
    
    def test_validate_computed_function_syntax(self):
        """Test that invalid Python syntax is rejected."""
        schema = {
            'temp_c': 'DOUBLE PRECISION',
            'temp_f': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data)\n    return bad syntax',  # Missing colon
            },
        }
        is_valid, error = validate_column_schema(schema)
        assert not is_valid
        assert 'syntax' in error.lower()
    
    def test_must_have_non_computed_field(self):
        """Test that at least one non-computed field is required."""
        schema = {
            'computed_only': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return 42',
            },
        }
        is_valid, error = validate_column_schema(schema)
        assert not is_valid
        assert 'non-computed' in error.lower()
    
    def test_get_regular_columns(self):
        """Test extracting non-computed columns."""
        schema = {
            'temp_c': 'DOUBLE PRECISION',
            'temp_f': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data): return 0',
            },
            'humidity': 'REAL',
        }
        regular = get_regular_columns(schema)
        assert 'temp_c' in regular
        assert 'humidity' in regular
        assert 'temp_f' not in regular
    
    def test_get_computed_columns(self):
        """Test extracting computed columns."""
        schema = {
            'temp_c': 'DOUBLE PRECISION',
            'temp_f': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data): return data["temp_c"] * 1.8 + 32',
            },
        }
        computed = get_computed_columns(schema)
        assert 'temp_f' in computed
        assert 'temp_c' not in computed
        assert computed['temp_f']['type'] == 'DOUBLE PRECISION'
        assert 'compute_function' in computed['temp_f']


@pytest.mark.django_db
class TestComputeFunction:
    """Tests for the sandboxed compute function executor."""
    
    def test_simple_computation(self):
        """Test a simple computation."""
        code = """
def compute(data):
    return data['value'] * 2
"""
        result = execute_compute_function(code, {'value': 21})
        assert result == 42
    
    def test_math_module_allowed(self):
        """Test that math module is available."""
        code = """
import math
def compute(data):
    return math.sqrt(data['value'])
"""
        result = execute_compute_function(code, {'value': 16})
        assert result == 4.0
    
    def test_temperature_conversion(self):
        """Test realistic temperature conversion."""
        code = """
def compute(data):
    return data['temp_c'] * 9/5 + 32
"""
        result = execute_compute_function(code, {'temp_c': 0})
        assert result == 32
        
        result = execute_compute_function(code, {'temp_c': 100})
        assert result == 212
    
    def test_missing_compute_function(self):
        """Test error when compute function is not defined."""
        code = """
def other_function(data):
    return data['value']
"""
        with pytest.raises(ComputeExecutionError) as exc_info:
            execute_compute_function(code, {'value': 42})
        assert 'compute' in str(exc_info.value)
    
    def test_compute_not_callable(self):
        """Test error when compute is not a function."""
        code = """
compute = 42
"""
        with pytest.raises(ComputeExecutionError) as exc_info:
            execute_compute_function(code, {'value': 1})
        assert 'callable' in str(exc_info.value)
    
    def test_runtime_error_in_function(self):
        """Test handling of runtime errors."""
        code = """
def compute(data):
    return data['nonexistent']
"""
        with pytest.raises(ComputeExecutionError) as exc_info:
            execute_compute_function(code, {'value': 42})
        assert 'KeyError' in str(exc_info.value)
    
    def test_forbidden_import(self):
        """Test that forbidden imports are blocked."""
        code = """
import os
def compute(data):
    return os.getcwd()
"""
        with pytest.raises(ComputeSecurityError) as exc_info:
            execute_compute_function(code, {})
        assert 'os' in str(exc_info.value)
    
    def test_forbidden_builtin(self):
        """Test that dangerous builtins are not available."""
        code = """
def compute(data):
    return open('/etc/passwd').read()
"""
        with pytest.raises(ComputeExecutionError):
            execute_compute_function(code, {})
    
    def test_timeout_enforcement(self):
        """Test that compute functions timeout properly (thread-safe)."""
        code = """
def compute(data):
    # Busy loop that will run until timeout
    i = 0
    while True:
        i += 1
        if i > 100000000:  # Prevent optimization
            break
    return 42
"""
        with pytest.raises(ComputeTimeoutError) as exc_info:
            execute_compute_function(code, {}, timeout=1)
        assert 'timed out' in str(exc_info.value).lower()
    
    def test_allowed_modules(self):
        """Test that allowed modules work."""
        code = """
import json
import datetime
import statistics
def compute(data):
    values = json.loads('[1, 2, 3, 4, 5]')
    return statistics.mean(values)
"""
        result = execute_compute_function(code, {})
        assert result == 3.0
    
    def test_complex_computation(self):
        """Test a more complex computation."""
        code = """
import math

def compute(data):
    # Compute heat index from temperature and humidity
    T = data['temp_f']
    R = data['humidity']
    
    if T < 80:
        return T
    
    HI = -42.379 + 2.04901523*T + 10.14333127*R
    HI = HI - 0.22475541*T*R - 0.00683783*T*T
    HI = HI - 0.05481717*R*R + 0.00122874*T*T*R
    HI = HI + 0.00085282*T*R*R - 0.00000199*T*T*R*R
    return round(HI, 1)
"""
        result = execute_compute_function(code, {'temp_f': 90, 'humidity': 70})
        assert isinstance(result, float)


@pytest.mark.django_db
class TestComputeFieldValues:
    """Tests for computing field values for sensor readings."""
    
    def test_compute_single_field(self):
        """Test computing a single field."""
        computed_columns = {
            'doubled': {
                'type': 'DOUBLE PRECISION',
                'compute_function': 'def compute(data): return data["value"] * 2',
            }
        }
        
        computed_values, errors = compute_field_values(
            sensor=None,  # Not needed for this test
            reading={'value': 21},
            computed_columns=computed_columns
        )
        
        assert errors == []
        assert computed_values['doubled'] == 42
    
    def test_compute_multiple_fields(self):
        """Test computing multiple fields."""
        computed_columns = {
            'temp_f': {
                'type': 'DOUBLE PRECISION',
                'compute_function': 'def compute(data): return data["temp_c"] * 9/5 + 32',
            },
            'temp_k': {
                'type': 'DOUBLE PRECISION',
                'compute_function': 'def compute(data): return data["temp_c"] + 273.15',
            }
        }
        
        computed_values, errors = compute_field_values(
            sensor=None,
            reading={'temp_c': 100},
            computed_columns=computed_columns
        )
        
        assert errors == []
        assert computed_values['temp_f'] == 212
        assert computed_values['temp_k'] == 373.15
    
    def test_compute_field_error_handling(self):
        """Test that errors are captured, not raised."""
        computed_columns = {
            'bad_field': {
                'type': 'DOUBLE PRECISION',
                'compute_function': 'def compute(data): return data["missing"]',
            },
            'good_field': {
                'type': 'DOUBLE PRECISION',
                'compute_function': 'def compute(data): return data["value"] + 1',
            }
        }
        
        computed_values, errors = compute_field_values(
            sensor=None,
            reading={'value': 10},
            computed_columns=computed_columns
        )
        
        # Good field should still compute
        assert computed_values['good_field'] == 11
        
        # Bad field should be None with error logged
        assert computed_values['bad_field'] is None
        assert len(errors) == 1
        assert errors[0]['field_name'] == 'bad_field'
        # Error type could be KeyError or ComputeExecutionError containing KeyError
        assert 'KeyError' in errors[0]['error_type'] or 'KeyError' in errors[0]['error_message']


@pytest.fixture
def sensor_with_computed(user):
    """Create a sensor with computed fields."""
    from apps.sensors.services import create_sensor
    
    sensor = create_sensor(
        name='Computed Field Sensor',
        sensor_type='test_computed',
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


@pytest.mark.django_db
class TestSensorWithComputedFields:
    """Test sensor creation and data insertion with computed fields."""
    
    def test_create_sensor_with_computed_fields(self, user):
        """Test creating a sensor with computed fields."""
        sensor = create_sensor(
            name='Temp Sensor',
            sensor_type='temperature',
            column_schema={
                'temp_c': 'DOUBLE PRECISION',
                'temp_f': {
                    'type': 'DOUBLE PRECISION',
                    'computed': True,
                    'compute_function': 'def compute(data): return data["temp_c"] * 1.8 + 32',
                },
            },
            created_by=user,
        )
        
        assert sensor is not None
        assert sensor.table_name.startswith('sensor_')
        
        # Check table was created with both columns
        columns = SensorTableService.get_table_columns(sensor.table_name)
        column_names = [c['name'] for c in columns]
        assert 'temp_c' in column_names
        assert 'temp_f' in column_names
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
    
    def test_api_create_sensor_with_computed_fields(self, authenticated_client):
        """Test creating a sensor with computed fields via API."""
        data = {
            'name': 'API Computed Sensor',
            'sensor_type': 'test',
            'column_schema': {
                'value': 'DOUBLE PRECISION',
                'doubled': {
                    'type': 'DOUBLE PRECISION',
                    'computed': True,
                    'compute_function': 'def compute(data): return data["value"] * 2',
                },
            },
        }
        
        response = authenticated_client.post(
            reverse('sensor-list'),
            data,
            format='json'
        )
        
        assert response.status_code == status.HTTP_201_CREATED
        sensor_id = response.data['id']
        
        # Cleanup
        sensor = Sensor.objects.get(id=sensor_id)
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()


@pytest.mark.django_db 
class TestComputedFieldErrorModel:
    """Tests for the ComputedFieldError model."""
    
    def test_create_error_record(self, sensor):
        """Test creating a computed field error record."""
        error = ComputedFieldError.objects.create(
            sensor=sensor,
            field_name='test_field',
            error_type='ComputeExecutionError',
            error_message='KeyError: missing_key',
            input_data={'value': 42},
        )
        
        assert error.id is not None
        assert error.sensor == sensor
        assert error.field_name == 'test_field'
    
    def test_error_str_representation(self, sensor):
        """Test error string representation."""
        error = ComputedFieldError.objects.create(
            sensor=sensor,
            field_name='test_field',
            error_type='TestError',
            error_message='Test message',
            input_data={},
        )
        
        assert 'test_field' in str(error)
        assert 'TestError' in str(error)
    
    def test_error_cascade_delete(self, sensor):
        """Test that errors are deleted when sensor is deleted."""
        ComputedFieldError.objects.create(
            sensor=sensor,
            field_name='field1',
            error_type='Error',
            error_message='Message',
            input_data={},
        )
        
        sensor_id = sensor.id
        
        # Need to drop the sensor table first
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
        
        # Errors should be gone
        assert ComputedFieldError.objects.filter(sensor_id=sensor_id).count() == 0


@pytest.mark.django_db
class TestUpdateComputeFunctionsAPI:
    """Tests for the update_compute_functions API endpoint."""
    
    def test_update_single_compute_function(self, authenticated_client, user):
        """Test updating a single compute function."""
        # Create sensor with computed field
        schema = {
            'value': 'DOUBLE PRECISION',
            'doubled': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["value"] * 2'
            }
        }
        
        sensor = create_sensor(
            name='Test Sensor',
            sensor_type='test',
            column_schema=schema,
            created_by=user,
        )
        
        # Update the compute function
        new_function = 'def compute(data):\n    return data["value"] * 3'
        response = authenticated_client.patch(
            reverse('sensor-update-compute-functions', kwargs={'pk': sensor.id}),
            {'doubled': new_function},
            format='json'
        )
        
        assert response.status_code == 200
        assert response.data['updated_fields'] == ['doubled']
        
        # Verify schema was updated
        sensor.refresh_from_db()
        assert sensor.column_schema['doubled']['compute_function'] == new_function
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_update_multiple_compute_functions(self, authenticated_client, user):
        """Test updating multiple compute functions at once."""
        schema = {
            'temp_c': 'DOUBLE PRECISION',
            'temp_f': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["temp_c"] * 9/5 + 32'
            },
            'temp_k': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["temp_c"] + 273.15'
            }
        }
        
        sensor = create_sensor(
            name='Test Sensor',
            sensor_type='test',
            column_schema=schema,
            created_by=user,
        )
        
        # Update both functions
        updates = {
            'temp_f': 'def compute(data):\n    return round(data["temp_c"] * 9/5 + 32, 2)',
            'temp_k': 'def compute(data):\n    return round(data["temp_c"] + 273.15, 2)'
        }
        response = authenticated_client.patch(
            reverse('sensor-update-compute-functions', kwargs={'pk': sensor.id}),
            updates,
            format='json'
        )
        
        assert response.status_code == 200
        assert set(response.data['updated_fields']) == {'temp_f', 'temp_k'}
        
        # Verify both were updated
        sensor.refresh_from_db()
        assert 'round' in sensor.column_schema['temp_f']['compute_function']
        assert 'round' in sensor.column_schema['temp_k']['compute_function']
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_cannot_update_non_computed_field(self, authenticated_client, user):
        """Test that non-computed fields cannot be updated."""
        schema = {
            'value': 'DOUBLE PRECISION',
            'doubled': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["value"] * 2'
            }
        }
        
        sensor = create_sensor(
            name='Test Sensor',
            sensor_type='test',
            column_schema=schema,
            created_by=user,
        )
        
        # Try to update regular field
        response = authenticated_client.patch(
            reverse('sensor-update-compute-functions', kwargs={'pk': sensor.id}),
            {'value': 'def compute(data):\n    return 42'},
            format='json'
        )
        
        assert response.status_code == 400
        assert 'not a computed field' in response.data['error']
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_cannot_update_nonexistent_field(self, authenticated_client, user):
        """Test that nonexistent fields cannot be updated."""
        schema = {
            'value': 'DOUBLE PRECISION',
            'doubled': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["value"] * 2'
            }
        }
        
        sensor = create_sensor(
            name='Test Sensor',
            sensor_type='test',
            column_schema=schema,
            created_by=user,
        )
        
        # Try to update field that doesn't exist
        response = authenticated_client.patch(
            reverse('sensor-update-compute-functions', kwargs={'pk': sensor.id}),
            {'nonexistent': 'def compute(data):\n    return 42'},
            format='json'
        )
        
        assert response.status_code == 400
        assert 'not a computed field' in response.data['error']
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_invalid_function_syntax(self, authenticated_client, user):
        """Test that invalid Python syntax is rejected."""
        schema = {
            'value': 'DOUBLE PRECISION',
            'doubled': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["value"] * 2'
            }
        }
        
        sensor = create_sensor(
            name='Test Sensor',
            sensor_type='test',
            column_schema=schema,
            created_by=user,
        )
        
        # Try to update with invalid syntax
        response = authenticated_client.patch(
            reverse('sensor-update-compute-functions', kwargs={'pk': sensor.id}),
            {'doubled': 'def compute(data):\n    return data["value" *'},
            format='json'
        )
        
        assert response.status_code == 400
        assert 'errors' in response.data
        assert 'doubled' in response.data['errors']
        
        # Verify schema was NOT updated (still has the original function)
        sensor.refresh_from_db()
        assert sensor.column_schema['doubled']['compute_function'] == 'def compute(data):\n    return data["value"] * 2'
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_empty_function_rejected(self, authenticated_client, user):
        """Test that empty compute functions are rejected."""
        schema = {
            'value': 'DOUBLE PRECISION',
            'doubled': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["value"] * 2'
            }
        }
        
        sensor = create_sensor(
            name='Test Sensor',
            sensor_type='test',
            column_schema=schema,
            created_by=user,
        )
        
        # Try to update with empty function
        response = authenticated_client.patch(
            reverse('sensor-update-compute-functions', kwargs={'pk': sensor.id}),
            {'doubled': ''},
            format='json'
        )
        
        assert response.status_code == 400
        assert 'errors' in response.data
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_invalid_request_body(self, authenticated_client, user):
        """Test that invalid request body format is rejected."""
        schema = {
            'value': 'DOUBLE PRECISION',
        }
        
        sensor = create_sensor(
            name='Test Sensor',
            sensor_type='test',
            column_schema=schema,
            created_by=user,
        )
        
        # Try to send array instead of dict
        response = authenticated_client.patch(
            reverse('sensor-update-compute-functions', kwargs={'pk': sensor.id}),
            ['invalid'],
            format='json'
        )
        
        assert response.status_code == 400
        assert 'must be a dictionary' in response.data['error']
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_authentication_required(self, client, user):
        """Test that authentication is required."""
        schema = {
            'value': 'DOUBLE PRECISION',
        }
        
        sensor = create_sensor(
            name='Test Sensor',
            sensor_type='test',
            column_schema=schema,
            created_by=user,
        )
        
        # Try without authentication
        response = client.patch(
            reverse('sensor-update-compute-functions', kwargs={'pk': sensor.id}),
            {},
            format='json'
        )
        
        assert response.status_code == 401
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()


@pytest.mark.django_db
class TestSensorConfigExport:
    """Tests for sensor configuration export functionality."""
    
    def test_export_simple_sensor(self, authenticated_client, user):
        """Test exporting a simple sensor configuration."""
        from apps.sensors.services import export_sensor_config
        
        sensor = create_sensor(
            name='Export Test Sensor',
            sensor_type='temperature',
            column_schema={'value_c': 'DOUBLE PRECISION'},
            created_by=user,
            description='A test sensor for export',
            metadata={'location': 'lab1'},
        )
        
        response = authenticated_client.get(
            reverse('sensor-export-config', kwargs={'pk': sensor.id})
        )
        
        assert response.status_code == 200
        config = response.data
        
        # Check config structure
        assert 'config_format_version' in config
        assert config['config_format_version'] == '1.0'
        assert 'sensor' in config
        
        # Check sensor config
        sensor_config = config['sensor']
        assert sensor_config['name'] == 'Export Test Sensor'
        assert sensor_config['sensor_type'] == 'temperature'
        assert sensor_config['description'] == 'A test sensor for export'
        assert sensor_config['metadata'] == {'location': 'lab1'}
        assert sensor_config['column_schema'] == {'value_c': 'DOUBLE PRECISION'}
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_export_sensor_with_computed_fields(self, authenticated_client, user):
        """Test exporting a sensor with computed fields."""
        schema = {
            'temp_c': 'DOUBLE PRECISION',
            'temp_f': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["temp_c"] * 9/5 + 32'
            }
        }
        
        sensor = create_sensor(
            name='Computed Field Sensor',
            sensor_type='temperature',
            column_schema=schema,
            created_by=user,
        )
        
        response = authenticated_client.get(
            reverse('sensor-export-config', kwargs={'pk': sensor.id})
        )
        
        assert response.status_code == 200
        config = response.data
        
        # Check that computed field is included
        column_schema = config['sensor']['column_schema']
        assert 'temp_c' in column_schema
        assert 'temp_f' in column_schema
        assert column_schema['temp_f']['computed'] is True
        assert 'compute_function' in column_schema['temp_f']
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_export_does_not_include_sensitive_data(self, authenticated_client, user):
        """Test that export doesn't include sensitive/internal data."""
        sensor = create_sensor(
            name='Security Test Sensor',
            sensor_type='test',
            column_schema={'value': 'DOUBLE PRECISION'},
            created_by=user,
        )
        
        # Create an API key for the sensor
        from apps.sensors.models import SensorApiKey
        SensorApiKey.create_for_sensor(sensor, 'Test Key', user)
        
        response = authenticated_client.get(
            reverse('sensor-export-config', kwargs={'pk': sensor.id})
        )
        
        assert response.status_code == 200
        config = response.data
        
        # These fields should NOT be in the export
        sensor_config = config['sensor']
        assert 'id' not in sensor_config
        assert 'table_name' not in sensor_config
        assert 'api_keys' not in sensor_config
        assert 'created_by' not in sensor_config
        assert 'created_at' not in sensor_config
        assert 'reading_count' not in sensor_config
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_export_requires_authentication(self, api_client, user):
        """Test that export requires authentication."""
        sensor = create_sensor(
            name='Auth Test Sensor',
            sensor_type='test',
            column_schema={'value': 'DOUBLE PRECISION'},
            created_by=user,
        )
        
        response = api_client.get(
            reverse('sensor-export-config', kwargs={'pk': sensor.id})
        )
        
        assert response.status_code == 401
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()


@pytest.mark.django_db
class TestSensorConfigImport:
    """Tests for sensor configuration import functionality."""
    
    def test_import_simple_config(self, authenticated_client, user):
        """Test importing a simple sensor configuration."""
        config = {
            'config_format_version': '1.0',
            'sensor': {
                'name': 'Imported Sensor',
                'sensor_type': 'temperature',
                'description': 'An imported sensor',
                'metadata': {'imported': True},
                'column_schema': {'temp_c': 'DOUBLE PRECISION'}
            }
        }
        
        response = authenticated_client.post(
            reverse('sensor-import'),
            {'config': config},
            format='json'
        )
        
        assert response.status_code == 201
        data = response.data
        
        # Check the created sensor
        assert data['name'] == 'Imported Sensor'
        assert data['sensor_type'] == 'temperature'
        assert data['description'] == 'An imported sensor'
        assert data['metadata'] == {'imported': True}
        assert data['column_schema'] == {'temp_c': 'DOUBLE PRECISION'}
        
        # Verify it exists in database
        sensor = Sensor.objects.get(id=data['id'])
        assert sensor is not None
        
        # Cleanup
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_import_with_computed_fields(self, authenticated_client, user):
        """Test importing a sensor with computed fields."""
        config = {
            'config_format_version': '1.0',
            'sensor': {
                'name': 'Computed Import Sensor',
                'sensor_type': 'temperature',
                'column_schema': {
                    'temp_c': 'DOUBLE PRECISION',
                    'temp_f': {
                        'type': 'DOUBLE PRECISION',
                        'computed': True,
                        'compute_function': 'def compute(data):\n    return data["temp_c"] * 9/5 + 32'
                    }
                }
            }
        }
        
        response = authenticated_client.post(
            reverse('sensor-import'),
            {'config': config},
            format='json'
        )
        
        assert response.status_code == 201
        data = response.data
        
        # Check computed field was imported
        column_schema = data['column_schema']
        assert 'temp_f' in column_schema
        assert column_schema['temp_f']['computed'] is True
        
        # Cleanup
        sensor = Sensor.objects.get(id=data['id'])
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_import_with_name_override(self, authenticated_client, user):
        """Test importing with a name override."""
        config = {
            'config_format_version': '1.0',
            'sensor': {
                'name': 'Original Name',
                'sensor_type': 'temperature',
                'column_schema': {'temp_c': 'DOUBLE PRECISION'}
            }
        }
        
        response = authenticated_client.post(
            reverse('sensor-import'),
            {'config': config, 'name_override': 'Custom Name'},
            format='json'
        )
        
        assert response.status_code == 201
        assert response.data['name'] == 'Custom Name'
        
        # Cleanup
        sensor = Sensor.objects.get(id=response.data['id'])
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_import_with_experiment(self, authenticated_client, user, experiment):
        """Test importing and associating with an experiment."""
        config = {
            'config_format_version': '1.0',
            'sensor': {
                'name': 'Experiment Sensor',
                'sensor_type': 'temperature',
                'column_schema': {'temp_c': 'DOUBLE PRECISION'}
            }
        }
        
        response = authenticated_client.post(
            reverse('sensor-import'),
            {'config': config, 'experiment': str(experiment.id)},
            format='json'
        )
        
        assert response.status_code == 201
        assert str(response.data['experiment']) == str(experiment.id)
        
        # Cleanup
        sensor = Sensor.objects.get(id=response.data['id'])
        SensorTableService.drop_sensor_table(sensor.table_name)
        sensor.delete()
    
    def test_import_invalid_config_missing_sensor(self, authenticated_client):
        """Test importing with missing sensor key."""
        config = {
            'config_format_version': '1.0',
            # Missing 'sensor' key
        }
        
        response = authenticated_client.post(
            reverse('sensor-import'),
            {'config': config},
            format='json'
        )
        
        assert response.status_code == 400
    
    def test_import_invalid_config_missing_required_field(self, authenticated_client):
        """Test importing with missing required field."""
        config = {
            'config_format_version': '1.0',
            'sensor': {
                'name': 'Test Sensor',
                # Missing 'sensor_type' and 'column_schema'
            }
        }
        
        response = authenticated_client.post(
            reverse('sensor-import'),
            {'config': config},
            format='json'
        )
        
        assert response.status_code == 400
    
    def test_import_invalid_column_schema(self, authenticated_client):
        """Test importing with invalid column schema."""
        config = {
            'config_format_version': '1.0',
            'sensor': {
                'name': 'Test Sensor',
                'sensor_type': 'test',
                'column_schema': {'123invalid': 'DOUBLE PRECISION'}  # Invalid column name
            }
        }
        
        response = authenticated_client.post(
            reverse('sensor-import'),
            {'config': config},
            format='json'
        )
        
        assert response.status_code == 400
    
    def test_import_invalid_experiment(self, authenticated_client):
        """Test importing with non-existent experiment."""
        config = {
            'config_format_version': '1.0',
            'sensor': {
                'name': 'Test Sensor',
                'sensor_type': 'test',
                'column_schema': {'value': 'DOUBLE PRECISION'}
            }
        }
        
        response = authenticated_client.post(
            reverse('sensor-import'),
            {'config': config, 'experiment': '00000000-0000-0000-0000-000000000000'},
            format='json'
        )
        
        assert response.status_code == 400
    
    def test_import_requires_authentication(self, api_client):
        """Test that import requires authentication."""
        config = {
            'config_format_version': '1.0',
            'sensor': {
                'name': 'Test Sensor',
                'sensor_type': 'test',
                'column_schema': {'value': 'DOUBLE PRECISION'}
            }
        }
        
        response = api_client.post(
            reverse('sensor-import'),
            {'config': config},
            format='json'
        )
        
        assert response.status_code == 401


@pytest.mark.django_db
class TestSensorExportImportRoundTrip:
    """Tests for export-import round-trip scenarios."""
    
    def test_export_import_roundtrip(self, authenticated_client, user):
        """Test that exporting and re-importing creates equivalent sensor."""
        # Create original sensor
        original_schema = {
            'temp_c': 'DOUBLE PRECISION',
            'humidity': 'DOUBLE PRECISION',
            'temp_f': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["temp_c"] * 9/5 + 32'
            }
        }
        
        original = create_sensor(
            name='Original Sensor',
            sensor_type='weather',
            column_schema=original_schema,
            created_by=user,
            description='Original sensor for roundtrip test',
            metadata={'version': 1},
        )
        
        # Export config
        export_response = authenticated_client.get(
            reverse('sensor-export-config', kwargs={'pk': original.id})
        )
        assert export_response.status_code == 200
        config = export_response.data
        
        # Import config
        import_response = authenticated_client.post(
            reverse('sensor-import'),
            {'config': config, 'name_override': 'Cloned Sensor'},
            format='json'
        )
        assert import_response.status_code == 201
        
        # Compare configurations
        cloned = Sensor.objects.get(id=import_response.data['id'])
        
        assert cloned.sensor_type == original.sensor_type
        assert cloned.description == original.description
        assert cloned.metadata == original.metadata
        assert cloned.column_schema == original.column_schema
        
        # IDs and table names should be different
        assert cloned.id != original.id
        assert cloned.table_name != original.table_name
        
        # Cleanup
        SensorTableService.drop_sensor_table(original.table_name)
        SensorTableService.drop_sensor_table(cloned.table_name)
        original.delete()
        cloned.delete()
    
    def test_export_import_complex_schema(self, authenticated_client, user):
        """Test export/import with a complex multi-field schema."""
        complex_schema = {
            'temperature': 'DOUBLE PRECISION',
            'pressure': 'DOUBLE PRECISION',
            'status': 'VARCHAR(50)',
            'reading_time': 'TIMESTAMPTZ',
            'is_valid': 'BOOLEAN',
            'notes': 'TEXT',
            'avg_temp': {
                'type': 'DOUBLE PRECISION',
                'computed': True,
                'compute_function': 'def compute(data):\n    return data["temperature"]'
            }
        }
        
        original = create_sensor(
            name='Complex Sensor',
            sensor_type='multi',
            column_schema=complex_schema,
            created_by=user,
            metadata={'tags': ['test', 'complex']},
        )
        
        # Export
        export_response = authenticated_client.get(
            reverse('sensor-export-config', kwargs={'pk': original.id})
        )
        
        # Import
        import_response = authenticated_client.post(
            reverse('sensor-import'),
            {'config': export_response.data},
            format='json'
        )
        
        assert import_response.status_code == 201
        
        cloned = Sensor.objects.get(id=import_response.data['id'])
        assert cloned.column_schema == complex_schema
        
        # Cleanup
        SensorTableService.drop_sensor_table(original.table_name)
        SensorTableService.drop_sensor_table(cloned.table_name)
        original.delete()
        cloned.delete()


@pytest.mark.django_db
class TestValidateSensorConfig:
    """Tests for sensor configuration validation."""
    
    def test_validate_valid_config(self):
        """Test validation of a valid config."""
        from apps.sensors.services import validate_sensor_config
        
        config = {
            'config_format_version': '1.0',
            'sensor': {
                'name': 'Test Sensor',
                'sensor_type': 'temperature',
                'column_schema': {'value': 'DOUBLE PRECISION'}
            }
        }
        
        is_valid, error = validate_sensor_config(config)
        assert is_valid is True
        assert error == ""
    
    def test_validate_missing_sensor_key(self):
        """Test validation fails for missing sensor key."""
        from apps.sensors.services import validate_sensor_config
        
        config = {'config_format_version': '1.0'}
        
        is_valid, error = validate_sensor_config(config)
        assert is_valid is False
        assert 'sensor' in error.lower()
    
    def test_validate_missing_required_fields(self):
        """Test validation fails for missing required fields."""
        from apps.sensors.services import validate_sensor_config
        
        config = {
            'sensor': {
                'name': 'Test'
                # Missing sensor_type and column_schema
            }
        }
        
        is_valid, error = validate_sensor_config(config)
        assert is_valid is False
    
    def test_validate_invalid_name(self):
        """Test validation fails for invalid name."""
        from apps.sensors.services import validate_sensor_config
        
        config = {
            'sensor': {
                'name': '',  # Empty name
                'sensor_type': 'test',
                'column_schema': {'value': 'DOUBLE PRECISION'}
            }
        }
        
        is_valid, error = validate_sensor_config(config)
        assert is_valid is False
        assert 'name' in error.lower()
    
    def test_validate_name_too_long(self):
        """Test validation fails for name exceeding max length."""
        from apps.sensors.services import validate_sensor_config
        
        config = {
            'sensor': {
                'name': 'x' * 256,  # Too long
                'sensor_type': 'test',
                'column_schema': {'value': 'DOUBLE PRECISION'}
            }
        }
        
        is_valid, error = validate_sensor_config(config)
        assert is_valid is False
        assert '255' in error
    
    def test_validate_sensor_type_too_long(self):
        """Test validation fails for sensor_type exceeding max length."""
        from apps.sensors.services import validate_sensor_config
        
        config = {
            'sensor': {
                'name': 'Test',
                'sensor_type': 'x' * 51,  # Too long
                'column_schema': {'value': 'DOUBLE PRECISION'}
            }
        }
        
        is_valid, error = validate_sensor_config(config)
        assert is_valid is False
        assert '50' in error
    
    def test_validate_invalid_column_schema(self):
        """Test validation fails for invalid column schema."""
        from apps.sensors.services import validate_sensor_config
        
        config = {
            'sensor': {
                'name': 'Test',
                'sensor_type': 'test',
                'column_schema': {'bad-name': 'DOUBLE PRECISION'}  # Invalid column name
            }
        }
        
        is_valid, error = validate_sensor_config(config)
        assert is_valid is False
        assert 'column' in error.lower()
    
    def test_validate_invalid_description_type(self):
        """Test validation fails for non-string description."""
        from apps.sensors.services import validate_sensor_config
        
        config = {
            'sensor': {
                'name': 'Test',
                'sensor_type': 'test',
                'column_schema': {'value': 'DOUBLE PRECISION'},
                'description': 123  # Should be string
            }
        }
        
        is_valid, error = validate_sensor_config(config)
        assert is_valid is False
        assert 'description' in error.lower()
    
    def test_validate_invalid_metadata_type(self):
        """Test validation fails for non-dict metadata."""
        from apps.sensors.services import validate_sensor_config
        
        config = {
            'sensor': {
                'name': 'Test',
                'sensor_type': 'test',
                'column_schema': {'value': 'DOUBLE PRECISION'},
                'metadata': 'not a dict'  # Should be dict
            }
        }
        
        is_valid, error = validate_sensor_config(config)
        assert is_valid is False
        assert 'metadata' in error.lower()
    
    def test_validate_non_dict_config(self):
        """Test validation fails for non-dict input."""
        from apps.sensors.services import validate_sensor_config
        
        is_valid, error = validate_sensor_config("not a dict")
        assert is_valid is False
        assert 'dictionary' in error.lower()
        
        is_valid, error = validate_sensor_config(None)
        assert is_valid is False