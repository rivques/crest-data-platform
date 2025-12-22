from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model

from .serializers import UserSerializer, UserCreateSerializer, ChangePasswordSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """Register a new user."""
    
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = UserCreateSerializer


class ProfileView(generics.RetrieveUpdateAPIView):
    """Get or update current user's profile."""
    
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """Change current user's password."""
    
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            request.user.set_password(serializer.validated_data['new_password'])
            request.user.save()
            return Response({"detail": "Password updated successfully."}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserListView(generics.ListAPIView):
    """List all users (admin only)."""
    
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]
