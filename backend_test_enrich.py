"""Backend tests for POST /api/events/enrich (event deep-dive).

The endpoint returns the real Wikipedia article intro for the event (free, no
API key). If GROQ_API_KEY is configured the backend returns an LLM-written
narrative instead. These tests cover auth, the Wikipedia path, and caching.

Run against a live backend:
    BACKEND_URL=http://127.0.0.1:8000 python backend_test_enrich.py
"""
import os
import sys
import time
import requests

BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BACKEND_URL}/api"
print(f"[config] API base: {API}")

DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@accaddeoggi.app")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "Demo1234")

AI_TIMEOUT = 45
results = []


def record(name, passed, detail=""):
    tag = "PASS" if passed else "FAIL"
    print(f"[{tag}] {name} -- {detail}")
    results.append((name, passed, detail))


def auth_login():
    r = requests.post(f"{API}/auth/login",
                      json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
                      timeout=20)
    r.raise_for_status()
    return r.json()["access_token"]


def test_1_unauth():
    r = requests.post(f"{API}/events/enrich",
                      json={"text": "Sbarco sulla Luna. Apollo 11.",
                            "year": 1969, "lang": "it"},
                      timeout=15)
    record("1. Unauthenticated -> 401",
           r.status_code == 401,
           f"status={r.status_code} body={r.text[:150]}")


def test_2_wikipedia_it(token):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "event_id": "test-apollo-11-it",
        "text": "Sbarco sulla Luna. Apollo 11 atterra sul Mare della Tranquillità.",
        "year": 1969,
        "category": "science",
        "lang": "it",
        "wiki_url": "https://it.wikipedia.org/wiki/Apollo_11",
    }
    t0 = time.time()
    r1 = requests.post(f"{API}/events/enrich", json=payload, headers=headers, timeout=AI_TIMEOUT)
    t_first = time.time() - t0
    if r1.status_code != 200:
        record("2a. Wikipedia IT first call -> 200", False,
               f"status={r1.status_code} body={r1.text[:300]}")
        return
    data = r1.json()
    text = data.get("text", "")
    record("2a. Wikipedia IT first call -> 200", True,
           f"{len(text)} chars, source={data.get('source')}, {t_first:.1f}s")
    record("2b. Non-empty deep dive", len(text) > 80, f"len={len(text)}")

    # Second call should be served from cache (fast + cached flag).
    r2 = requests.post(f"{API}/events/enrich", json=payload, headers=headers, timeout=AI_TIMEOUT)
    record("2c. Second call cached", r2.status_code == 200 and r2.json().get("cached") is True,
           f"cached={r2.json().get('cached')}")


def test_3_no_wiki_url(token):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"text": "Evento senza pagina Wikipedia collegata.", "year": 1900, "lang": "it"}
    r = requests.post(f"{API}/events/enrich", json=payload, headers=headers, timeout=AI_TIMEOUT)
    # Without a wiki_url and without GROQ_API_KEY the backend returns 502 (no content).
    ok = r.status_code in (200, 502)
    record("3. Missing wiki_url handled gracefully", ok, f"status={r.status_code}")


if __name__ == "__main__":
    test_1_unauth()
    tok = auth_login()
    test_2_wikipedia_it(tok)
    test_3_no_wiki_url(tok)
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)
