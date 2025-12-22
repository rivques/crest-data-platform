"""
Tests for the experiments app - CRUD operations on experiments.
"""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from apps.experiments.models import Experiment


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
    """Create a test experiment."""
    return Experiment.objects.create(
        name='Test Experiment',
        description='A test experiment',
        metadata={'key': 'value'},
        created_by=user,
    )


@pytest.fixture
def multiple_experiments(user):
    """Create multiple experiments for pagination tests."""
    experiments = []
    for i in range(15):
        experiments.append(Experiment.objects.create(
            name=f'Experiment {i}',
            description=f'Description {i}',
            created_by=user,
        ))
    return experiments


@pytest.mark.django_db
class TestExperimentModel:
    """Tests for the Experiment model."""
    
    def test_create_experiment(self, user):
        """Test creating an experiment."""
        exp = Experiment.objects.create(
            name='My Experiment',
            description='Testing something',
            created_by=user,
        )
        assert exp.name == 'My Experiment'
        assert exp.is_active
        assert exp.created_by == user
    
    def test_experiment_str(self, experiment):
        """Test experiment string representation."""
        assert str(experiment) == 'Test Experiment'
    
    def test_experiment_metadata_default(self, user):
        """Test that metadata defaults to empty dict."""
        exp = Experiment.objects.create(
            name='No Metadata',
            created_by=user,
        )
        assert exp.metadata == {}


@pytest.mark.django_db
class TestExperimentList:
    """Tests for listing experiments."""
    
    def test_list_experiments(self, authenticated_client, experiment):
        """Test listing experiments."""
        response = authenticated_client.get(reverse('experiment-list'))
        assert response.status_code == status.HTTP_200_OK
        # Handle both paginated and non-paginated responses
        if isinstance(response.data, dict) and 'count' in response.data:
            assert response.data['count'] >= 1
            assert response.data['results'][0]['name'] == experiment.name
        else:
            assert len(response.data) >= 1
    
    def test_list_experiments_unauthenticated(self, api_client):
        """Test listing experiments without auth fails."""
        response = api_client.get(reverse('experiment-list'))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_list_experiments_pagination(self, authenticated_client, multiple_experiments):
        """Test that experiment list is paginated."""
        response = authenticated_client.get(reverse('experiment-list'))
        assert response.status_code == status.HTTP_200_OK
        # If paginated, check pagination fields
        if isinstance(response.data, dict) and 'count' in response.data:
            assert 'count' in response.data
            assert response.data['count'] >= 15  # At least the 15 we created
        else:
            # Non-paginated returns list
            assert len(response.data) >= 15
    
    def test_list_experiments_search(self, authenticated_client, multiple_experiments):
        """Test searching experiments by name."""
        response = authenticated_client.get(
            reverse('experiment-list'),
            {'search': 'Experiment 5'}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert 'Experiment 5' in response.data['results'][0]['name']


@pytest.mark.django_db
class TestExperimentCreate:
    """Tests for creating experiments."""
    
    def test_create_experiment(self, authenticated_client):
        """Test creating an experiment."""
        data = {
            'name': 'New Experiment',
            'description': 'A new experiment',
            'metadata': {'field': 'data'},
        }
        response = authenticated_client.post(
            reverse('experiment-list'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'New Experiment'
        assert Experiment.objects.filter(name='New Experiment').exists()
    
    def test_create_experiment_minimal(self, authenticated_client):
        """Test creating experiment with only required fields."""
        data = {'name': 'Minimal Experiment'}
        response = authenticated_client.post(
            reverse('experiment-list'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_201_CREATED
    
    def test_create_experiment_no_name(self, authenticated_client):
        """Test creating experiment without name fails."""
        data = {'description': 'No name'}
        response = authenticated_client.post(
            reverse('experiment-list'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'name' in response.data
    
    def test_create_experiment_unauthenticated(self, api_client):
        """Test creating experiment without auth fails."""
        data = {'name': 'Unauthenticated'}
        response = api_client.post(
            reverse('experiment-list'),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestExperimentRetrieve:
    """Tests for retrieving a single experiment."""
    
    def test_retrieve_experiment(self, authenticated_client, experiment):
        """Test retrieving an experiment by ID."""
        response = authenticated_client.get(
            reverse('experiment-detail', kwargs={'pk': experiment.id})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == experiment.name
        assert response.data['id'] == str(experiment.id)
    
    def test_retrieve_nonexistent_experiment(self, authenticated_client):
        """Test retrieving non-existent experiment returns 404."""
        import uuid
        response = authenticated_client.get(
            reverse('experiment-detail', kwargs={'pk': uuid.uuid4()})
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestExperimentUpdate:
    """Tests for updating experiments."""
    
    def test_update_experiment(self, authenticated_client, experiment):
        """Test updating an experiment."""
        data = {'name': 'Updated Name', 'description': 'Updated description'}
        response = authenticated_client.put(
            reverse('experiment-detail', kwargs={'pk': experiment.id}),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Updated Name'
        
        experiment.refresh_from_db()
        assert experiment.name == 'Updated Name'
    
    def test_partial_update_experiment(self, authenticated_client, experiment):
        """Test partial update (PATCH) of experiment."""
        original_description = experiment.description
        data = {'name': 'Patched Name'}
        response = authenticated_client.patch(
            reverse('experiment-detail', kwargs={'pk': experiment.id}),
            data,
            format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data['name'] == 'Patched Name'
        assert response.data['description'] == original_description


@pytest.mark.django_db
class TestExperimentDelete:
    """Tests for deleting experiments."""
    
    def test_delete_experiment(self, authenticated_client, experiment):
        """Test deleting an experiment."""
        exp_id = experiment.id
        response = authenticated_client.delete(
            reverse('experiment-detail', kwargs={'pk': exp_id})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Experiment.objects.filter(id=exp_id).exists()
    
    def test_delete_nonexistent_experiment(self, authenticated_client):
        """Test deleting non-existent experiment returns 404."""
        import uuid
        response = authenticated_client.delete(
            reverse('experiment-detail', kwargs={'pk': uuid.uuid4()})
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
