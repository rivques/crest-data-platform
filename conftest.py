"""
Pytest configuration and shared fixtures for CREST Data Platform tests.
"""

import pytest
from django.conf import settings


@pytest.fixture(scope='session')
def django_db_setup():
    """Configure test database."""
    settings.DATABASES['default'] = {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'crest_test',
        'USER': settings.DATABASES['default']['USER'],
        'PASSWORD': settings.DATABASES['default']['PASSWORD'],
        'HOST': settings.DATABASES['default']['HOST'],
        'PORT': settings.DATABASES['default']['PORT'],
        'ATOMIC_REQUESTS': True,
    }


@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
    """
    Automatically enable database access for all tests.
    This is useful because most of our tests need DB access.
    """
    pass
