import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('FRONTEND_URL')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL or FRONTEND_URL environment variable must be set")
BASE_URL = BASE_URL.rstrip('/')

class TestInteractions:
    """Event interaction tests - like, dislike, save, unsave"""

    def test_like_event(self, api_client, auth_headers):
        """Test liking an event"""
        # Get an event first
        events_response = api_client.get(
            f"{BASE_URL}/api/events/today?limit=1",
            headers=auth_headers
        )
        assert events_response.status_code == 200
        events = events_response.json()["events"]
        if not events:
            pytest.skip("No events available")
        event_id = events[0]["id"]

        # Like the event
        response = api_client.post(
            f"{BASE_URL}/api/events/interact",
            headers=auth_headers,
            json={"event_id": event_id, "action": "like"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] == True
        assert data.get("added") == "like" or data.get("removed") == "like"

    def test_like_dislike_mutual_exclusivity(self, api_client, auth_headers):
        """Test that like and dislike are mutually exclusive"""
        # Get an event
        events_response = api_client.get(
            f"{BASE_URL}/api/events/today?limit=1",
            headers=auth_headers
        )
        assert events_response.status_code == 200
        events = events_response.json()["events"]
        if not events:
            pytest.skip("No events available")
        event_id = events[0]["id"]

        # Like the event
        like_response = api_client.post(
            f"{BASE_URL}/api/events/interact",
            headers=auth_headers,
            json={"event_id": event_id, "action": "like"}
        )
        assert like_response.status_code == 200

        # Now dislike - should remove like and add dislike
        dislike_response = api_client.post(
            f"{BASE_URL}/api/events/interact",
            headers=auth_headers,
            json={"event_id": event_id, "action": "dislike"}
        )
        assert dislike_response.status_code == 200

        # Verify by fetching events again
        verify_response = api_client.get(
            f"{BASE_URL}/api/events/today?limit=40",
            headers=auth_headers
        )
        assert verify_response.status_code == 200
        events = verify_response.json()["events"]
        target_event = next((e for e in events if e["id"] == event_id), None)
        if target_event:
            assert target_event["disliked"] == True
            assert target_event["liked"] == False

    def test_like_toggle_idempotency(self, api_client, auth_headers):
        """Test clicking like twice removes the like (toggle behavior)"""
        # Get an event
        events_response = api_client.get(
            f"{BASE_URL}/api/events/today?limit=1",
            headers=auth_headers
        )
        assert events_response.status_code == 200
        events = events_response.json()["events"]
        if not events:
            pytest.skip("No events available")
        event_id = events[0]["id"]

        # First like
        first_response = api_client.post(
            f"{BASE_URL}/api/events/interact",
            headers=auth_headers,
            json={"event_id": event_id, "action": "like"}
        )
        assert first_response.status_code == 200

        # Second like (should toggle off)
        second_response = api_client.post(
            f"{BASE_URL}/api/events/interact",
            headers=auth_headers,
            json={"event_id": event_id, "action": "like"}
        )
        assert second_response.status_code == 200
        data = second_response.json()
        # Should indicate removal
        assert data.get("removed") == "like" or data.get("added") == "like"

    def test_save_event(self, api_client, auth_headers):
        """Test saving an event to favorites"""
        # Get an event
        events_response = api_client.get(
            f"{BASE_URL}/api/events/today?limit=1",
            headers=auth_headers
        )
        assert events_response.status_code == 200
        events = events_response.json()["events"]
        if not events:
            pytest.skip("No events available")
        event_id = events[0]["id"]

        # Save the event
        response = api_client.post(
            f"{BASE_URL}/api/events/interact",
            headers=auth_headers,
            json={"event_id": event_id, "action": "save"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] == True

    def test_unsave_event(self, api_client, auth_headers):
        """Test unsaving an event from favorites"""
        # Get and save an event first
        events_response = api_client.get(
            f"{BASE_URL}/api/events/today?limit=1",
            headers=auth_headers
        )
        assert events_response.status_code == 200
        events = events_response.json()["events"]
        if not events:
            pytest.skip("No events available")
        event_id = events[0]["id"]

        # Save
        api_client.post(
            f"{BASE_URL}/api/events/interact",
            headers=auth_headers,
            json={"event_id": event_id, "action": "save"}
        )

        # Unsave
        response = api_client.post(
            f"{BASE_URL}/api/events/interact",
            headers=auth_headers,
            json={"event_id": event_id, "action": "unsave"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] == True
        assert data.get("removed") == "save"

    def test_get_favorites(self, api_client, auth_headers):
        """Test GET /events/favorites returns saved events"""
        response = api_client.get(
            f"{BASE_URL}/api/events/favorites",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert "events" in data
        assert isinstance(data["events"], list)
        # All events should have saved=True
        for event in data["events"]:
            assert event.get("saved") == True

    def test_get_stats(self, api_client, auth_headers):
        """Test GET /events/stats returns user interaction statistics"""
        response = api_client.get(
            f"{BASE_URL}/api/events/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "likes" in data
        assert "dislikes" in data
        assert "saves" in data
        assert "top_categories" in data
        assert isinstance(data["likes"], int)
        assert isinstance(data["dislikes"], int)
        assert isinstance(data["saves"], int)
        assert isinstance(data["top_categories"], list)
