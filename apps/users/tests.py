"""
Tests for the users app - authentication, user management, JWT tokens.
"""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_data():
    return {
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'testpass123',
    }


@pytest.fixture
def create_user(user_data):
    """Create a test user."""
    user = User.objects.create_user(
        username=user_data['username'],
        email=user_data['email'],
        password=user_data['password'],
    )
    return user


@pytest.fixture
def admin_user():
    """Create an admin user."""
    return User.objects.create_user(
        username='admin',
        email='admin@example.com',
        password='adminpass123',
        role=User.Role.ADMIN,
        is_staff=True,
    )


@pytest.fixture
def authenticated_client(api_client, create_user, user_data):
    """Return an authenticated API client."""
    response = api_client.post(
        reverse('token_obtain_pair'),
        {'username': user_data['username'], 'password': user_data['password']},
        format='json'
    )
    token = response.data['access']
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return api_client


@pytest.fixture
def admin_client(api_client, admin_user):
    """Return an authenticated admin API client."""
    response = api_client.post(
        reverse('token_obtain_pair'),
        {'username': 'admin', 'password': 'adminpass123'},
        format='json'
    )
    token = response.data['access']
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return api_client


@pytest.mark.django_db
class TestUserModel:
    """Tests for the User model."""
    
    def test_create_user(self, user_data):
        """Test creating a user with valid data."""
        user = User.objects.create_user(
            username=user_data['username'],
            email=user_data['email'],
            password=user_data['password'],
        )
        assert user.username == user_data['username']
        assert user.email == user_data['email']
        assert user.check_password(user_data['password'])
        assert user.role == User.Role.VIEWER  # Default role
    
    def test_user_roles(self):
        """Test user role properties."""
        viewer = User.objects.create_user(
            username='viewer', email='v@test.com', password='pass',
            role=User.Role.VIEWER
        )
        editor = User.objects.create_user(
            username='editor', email='e@test.com', password='pass',
            role=User.Role.EDITOR
        )
        admin_user = User.objects.create_user(
            username='adminrole', email='a@test.com', password='pass',
            role=User.Role.ADMIN
        )
        
        assert not viewer.is_editor_or_above
        assert not viewer.is_admin_user
        
        assert editor.is_editor_or_above
        assert not editor.is_admin_user
        
        assert admin_user.is_editor_or_above
        assert admin_user.is_admin_user
    
    def test_user_str(self, create_user):
        """Test user string representation."""
        assert str(create_user) == 'testuser'


@pytest.mark.django_db
class TestAuthentication:
    """Tests for JWT authentication."""
    
    def test_login_success(self, api_client, create_user, user_data):
        """Test successful login returns tokens."""
        response = api_client.post(
            reverse('token_obtain_pair'),
            {'username': user_data['username'], 'password': user_data['password']},
            format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
    
    def test_login_wrong_password(self, api_client, create_user, user_data):
        """Test login with wrong password fails."""
        response = api_client.post(
            reverse('token_obtain_pair'),
            {'username': user_data['username'], 'password': 'wrongpassword'},
            format='json'
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_login_nonexistent_user(self, api_client):
        """Test login with non-existent user fails."""
        response = api_client.post(
            reverse('token_obtain_pair'),
            {'username': 'nonexistent', 'password': 'password'},
            format='json'
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_token_refresh(self, api_client, create_user, user_data):
        """Test refreshing access token."""
        # First login
        login_response = api_client.post(
            reverse('token_obtain_pair'),
            {'username': user_data['username'], 'password': user_data['password']},
            format='json'
        )
        refresh_token = login_response.data['refresh']
        
        # Refresh token
        response = api_client.post(
            reverse('token_refresh'),
            {'refresh': refresh_token},
            format='json'
        )
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
    
    def test_token_refresh_invalid(self, api_client):
        """Test refresh with invalid token fails."""
        response = api_client.post(
            reverse('token_refresh'),
            {'refresh': 'invalid-token'},
            format='json'
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_protected_endpoint_without_auth(self, api_client):
        """Test accessing protected endpoint without authentication."""
        response = api_client.get(reverse('experiment-list'))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_protected_endpoint_with_auth(self, authenticated_client):
        """Test accessing protected endpoint with valid authentication."""
        response = authenticated_client.get(reverse('experiment-list'))
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestUserProfile:
    """Tests for user profile endpoint."""
    
    def test_get_profile(self, authenticated_client, create_user):
        """Test getting own profile."""
        response = authenticated_client.get(reverse('profile'))
        assert response.status_code == status.HTTP_200_OK
        assert response.data['username'] == create_user.username
        assert response.data['email'] == create_user.email
    
    def test_get_profile_unauthenticated(self, api_client):
        """Test getting profile without authentication."""
        response = api_client.get(reverse('profile'))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
