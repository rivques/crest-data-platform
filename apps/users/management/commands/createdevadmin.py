"""
Management command to create a default admin user for development.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Create a default admin user for development'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            default='admin',
            help='Username for the admin user (default: admin)'
        )
        parser.add_argument(
            '--email',
            default='admin@crest.local',
            help='Email for the admin user (default: admin@crest.local)'
        )
        parser.add_argument(
            '--password',
            default='admin',
            help='Password for the admin user (default: admin)'
        )

    def handle(self, *args, **options):
        username = options['username']
        email = options['email']
        password = options['password']

        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f'User "{username}" already exists.')
            )
            return

        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
            role='admin'
        )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created admin user: {username}')
        )
