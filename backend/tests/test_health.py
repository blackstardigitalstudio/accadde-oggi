import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('FRONTEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL or FRONTEND_URL environment variable must be set")
BASE_URL = BASE_URL.rstrip('/')

class TestHealth:
    """Health check and basic connectivity tests"""

    def test_root_endpoint(self, api_client):
        """Test API root endpoint returns status ok"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "name" in data
