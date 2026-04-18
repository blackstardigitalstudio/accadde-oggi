import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('FRONTEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL or FRONTEND_URL environment variable must be set")
BASE_URL = BASE_URL.rstrip('/')

class TestAuth:
    """Authentication endpoint tests"""

    def test_register_new_user(self, api_client):
        """Test user registration with all fields including country"""
        timestamp = int(time.time())
        email = f"TEST_user_{timestamp}@test.com"
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123",
            "name": "Test User",
            "language": "it",
            "country": "IT"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        user = data["user"]
        assert user["email"] == email.lower()  # Backend lowercases emails
        assert user["name"] == "Test User"
        assert user["language"] == "it"
        assert user["country"] == "IT"
        assert user["role"] == "user"
        assert user["notifications_enabled"] == True

    def test_register_duplicate_email(self, api_client):
        """Test registration with existing email fails"""
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": "admin@accaddeoggi.app",
            "password": "TestPass123",
            "name": "Duplicate"
        })
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    def test_login_success(self, api_client):
        """Test login with correct credentials returns tokens and user"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@accaddeoggi.app",
            "password": "Demo1234"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "user" in data
        user = data["user"]
        assert user["email"] == "demo@accaddeoggi.app"
        assert "country" in user

    def test_login_wrong_password(self, api_client):
        """Test login with wrong password fails"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@accaddeoggi.app",
            "password": "WrongPassword"
        })
        assert response.status_code == 401
        assert "invalid" in response.json()["detail"].lower()

    def test_login_nonexistent_user(self, api_client):
        """Test login with non-existent email fails"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "SomePassword"
        })
        assert response.status_code == 401

    def test_get_me_with_token(self, api_client, demo_token):
        """Test GET /auth/me returns user data with valid Bearer token"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200
        user = response.json()
        assert user["email"] == "demo@accaddeoggi.app"
        assert "country" in user
        assert "language" in user
        assert "notifications_enabled" in user

    def test_get_me_without_token(self, api_client):
        """Test GET /auth/me without token fails"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401

    def test_refresh_token(self, api_client):
        """Test refresh token exchange for new access token"""
        # Login to get refresh token
        login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@accaddeoggi.app",
            "password": "Demo1234"
        })
        assert login_response.status_code == 200
        refresh_token = login_response.json()["refresh_token"]

        # Use refresh token to get new access token
        refresh_response = api_client.post(f"{BASE_URL}/api/auth/refresh", json={
            "refresh_token": refresh_token
        })
        assert refresh_response.status_code == 200
        data = refresh_response.json()
        assert "access_token" in data

    def test_update_user_preferences(self, api_client, demo_token):
        """Test PATCH /auth/me updates language, country, notifications"""
        # Update preferences
        response = api_client.patch(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={
                "language": "es",
                "country": "ES",
                "notifications_enabled": False
            }
        )
        assert response.status_code == 200
        user = response.json()
        assert user["language"] == "es"
        assert user["country"] == "ES"
        assert user["notifications_enabled"] == False

        # Verify persistence by fetching user again
        get_response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert get_response.status_code == 200
        verified_user = get_response.json()
        assert verified_user["language"] == "es"
        assert verified_user["country"] == "ES"
        assert verified_user["notifications_enabled"] == False

        # Reset to IT for other tests
        api_client.patch(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"language": "it", "country": "IT", "notifications_enabled": True}
        )
