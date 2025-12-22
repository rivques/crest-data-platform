from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model for CREST Data Platform.
    Extends Django's AbstractUser to allow future customization.
    """
    
    class Role(models.TextChoices):
        VIEWER = 'viewer', 'Viewer'
        EDITOR = 'editor', 'Editor'
        ADMIN = 'admin', 'Admin'
    
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.VIEWER,
        help_text="User's permission level in the platform"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
    
    def __str__(self):
        return self.username
    
    @property
    def is_editor_or_above(self):
        return self.role in [self.Role.EDITOR, self.Role.ADMIN]
    
    @property
    def is_admin_user(self):
        return self.role == self.Role.ADMIN
