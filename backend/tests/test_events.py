import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('FRONTEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL or FRONTEND_URL environment variable must be set")
BASE_URL = BASE_URL.rstrip('/')

class TestEvents:
    """Event endpoints tests - fetching, filtering, multi-language"""

    def test_get_events_today_basic(self, api_client, auth_headers):
        """Test GET /events/today returns events with required fields"""
        response = api_client.get(
            f"{BASE_URL}/api/events/today",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "date" in data
        assert "lang" in data
        assert "country" in data
        assert "count" in data
        assert "events" in data
        assert isinstance(data["events"], list)

        # Check event structure
        if data["events"]:
            event = data["events"][0]
            required_fields = [
                "id", "year", "years_ago", "title", "text",
                "category", "scope", "sources", "countries",
                "liked", "disliked", "saved"
            ]
            for field in required_fields:
                assert field in event, f"Missing field: {field}"
            assert event["scope"] in ["global", "local"]
            assert isinstance(event["sources"], list)
            assert isinstance(event["countries"], list)

    def test_events_italian_user(self, api_client, demo_token):
        """Test Italian user gets IT-relevant events"""
        # Set user to Italian
        api_client.patch(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"language": "it", "country": "IT"}
        )

        response = api_client.get(
            f"{BASE_URL}/api/events/today?lang=it&country=IT",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["lang"] == "it"
        assert data["country"] == "IT"

    def test_events_spanish_user(self, api_client, demo_token):
        """Test Spanish user gets ES-relevant events (different from IT)"""
        # Set user to Spanish
        api_client.patch(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"language": "es", "country": "ES"}
        )

        response = api_client.get(
            f"{BASE_URL}/api/events/today?lang=es&country=ES",
            headers={"Authorization": f"Bearer {demo_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["lang"] == "es"
        assert data["country"] == "ES"

        # Reset to IT
        api_client.patch(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {demo_token}"},
            json={"language": "it", "country": "IT"}
        )

    def test_filter_by_category(self, api_client, auth_headers):
        """Test filtering events by category"""
        response = api_client.get(
            f"{BASE_URL}/api/events/today?category=science",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # All returned events should be science category
        for event in data["events"]:
            assert event["category"] == "science"

    def test_filter_by_decade(self, api_client, auth_headers):
        """Test filtering events by decade"""
        response = api_client.get(
            f"{BASE_URL}/api/events/today?decade=2000",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # All returned events should be from 2000-2009
        for event in data["events"]:
            assert 2000 <= event["year"] <= 2009

    def test_filter_by_scope_global(self, api_client, auth_headers):
        """Test filtering for global events only"""
        response = api_client.get(
            f"{BASE_URL}/api/events/today?scope=global",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # All returned events should be global
        for event in data["events"]:
            assert event["scope"] == "global"

    def test_filter_by_scope_local(self, api_client, auth_headers):
        """Test filtering for local events only"""
        response = api_client.get(
            f"{BASE_URL}/api/events/today?scope=local",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # All returned events should be local
        for event in data["events"]:
            assert event["scope"] == "local"

    def test_get_categories(self, api_client, auth_headers):
        """Test GET /events/categories returns category list"""
        response = api_client.get(
            f"{BASE_URL}/api/events/categories",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        assert len(categories) > 0
        # Check structure
        for cat in categories:
            assert "id" in cat
            assert "color" in cat
        # Check expected categories exist
        cat_ids = [c["id"] for c in categories]
        expected = ["wars", "science", "culture", "sports", "politics"]
        for exp in expected:
            assert exp in cat_ids
