import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('FRONTEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL or FRONTEND_URL environment variable must be set")
BASE_URL = BASE_URL.rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def admin_token(api_client):
    """Get admin access token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@accaddeoggi.app",
        "password": "Admin1234"
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Admin login failed")

@pytest.fixture
def demo_token(api_client):
    """Get demo user access token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "demo@accaddeoggi.app",
        "password": "Demo1234"
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Demo login failed")

@pytest.fixture
def auth_headers(demo_token):
    """Authorization headers with Bearer token"""
    return {"Authorization": f"Bearer {demo_token}"}
