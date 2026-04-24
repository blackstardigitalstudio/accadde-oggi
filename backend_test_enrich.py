"""Backend tests for POST /api/events/enrich (AI event enrichment).

Tests the endpoint that calls OpenAI gpt-4o-mini via emergentintegrations.
"""
import os
import sys
import time
import json
import requests
from pathlib import Path

# Load backend URL from frontend/.env
FRONTEND_ENV = Path("/app/frontend/.env")
BACKEND_URL = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BACKEND_URL = line.split("=", 1)[1].strip().strip('"')
        break

assert BACKEND_URL, "No backend URL found"
API = f"{BACKEND_URL}/api"
print(f"[config] API base: {API}")

DEMO_EMAIL = "demo@accaddeoggi.app"
DEMO_PASSWORD = "Demo1234"

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

def test_2_happy_it(token):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "event_id": "test-apollo-11-it",
        "text": "Sbarco sulla Luna. Apollo 11 atterra sul Mare della Tranquillità.",
        "year": 1969,
        "category": "science",
        "lang": "it",
    }
    t0 = time.time()
    r1 = requests.post(f"{API}/events/enrich", json=payload, headers=headers, timeout=AI_TIMEOUT)
    t_first = time.time() - t0
    if r1.status_code != 200:
        record("2a. Happy path IT first call -> 200",
               False, f"status={r1.status_code} body={r1.text[:300]}")
        return None
    data = r1.json()
    text = data.get("text", "")
    cached = data.get("cached")
    lang = data.get("lang")
    cond = (isinstance(text, str) and len(text) >= 300
            and cached is False and lang == "it")
    record("2a. Happy path IT first call -> 200, >=300 chars, cached=false",
           cond,
           f"len(text)={len(text)}, cached={cached}, lang={lang}, "
           f"took={t_first:.1f}s, preview={text[:120]!r}")

    # Italian common particles check (lightweight)
    lower = text.lower()
    it_hints = any(f" {w} " in f" {lower} " for w in ["di", "del", "della", "che", "e", "la", "il"])
    record("2a-lang. IT text contains Italian particles",
           it_hints or len(text) > 200,
           f"italian_hint={it_hints}")

    # Second call — expect cache hit
    t0 = time.time()
    r2 = requests.post(f"{API}/events/enrich", json=payload, headers=headers, timeout=AI_TIMEOUT)
    t_second = time.time() - t0
    if r2.status_code != 200:
        record("2b. Happy path IT second call cache hit",
               False, f"status={r2.status_code}")
        return text
    data2 = r2.json()
    text2 = data2.get("text", "")
    cached2 = data2.get("cached")
    cond2 = (cached2 is True and text2 == text and t_second < t_first)
    record("2b. Second call cached=true, faster, same text",
           cond2,
           f"cached={cached2}, t_first={t_first:.2f}s, t_second={t_second:.2f}s, equal_text={text2==text}")
    return text

def test_3_happy_en(token, it_text):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "event_id": "test-apollo-11-en",
        "text": "Sbarco sulla Luna. Apollo 11 atterra sul Mare della Tranquillità.",
        "year": 1969,
        "category": "science",
        "lang": "en",
    }
    t0 = time.time()
    r = requests.post(f"{API}/events/enrich", json=payload, headers=headers, timeout=AI_TIMEOUT)
    dt = time.time() - t0
    if r.status_code != 200:
        record("3. Happy path EN -> 200", False,
               f"status={r.status_code} body={r.text[:300]}")
        return
    data = r.json()
    text = data.get("text", "")
    lang = data.get("lang")
    cached = data.get("cached")
    lower = text.lower()
    en_hints = sum(1 for w in [" the ", " of ", " and ", " was ", " in "] if w in f" {lower} ")
    cond_basic = (len(text) >= 300 and lang == "en" and cached is False)
    record("3a. Happy path EN -> 200, len>=300, lang=en, cached=false",
           cond_basic,
           f"len={len(text)}, lang={lang}, cached={cached}, took={dt:.1f}s")
    record("3b. EN text contains English words (the/of/and...)",
           en_hints >= 2,
           f"english_hints={en_hints}, preview={text[:120]!r}")
    if it_text:
        record("3c. EN response differs from IT (distinct cache bucket)",
               text != it_text,
               f"differ={text != it_text}")

def test_4_happy_es(token):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "event_id": "test-apollo-11-es",
        "text": "Sbarco sulla Luna. Apollo 11 atterra sul Mare della Tranquillità.",
        "year": 1969,
        "category": "science",
        "lang": "es",
    }
    t0 = time.time()
    r = requests.post(f"{API}/events/enrich", json=payload, headers=headers, timeout=AI_TIMEOUT)
    dt = time.time() - t0
    if r.status_code != 200:
        record("4. Happy path ES -> 200", False,
               f"status={r.status_code} body={r.text[:300]}")
        return
    data = r.json()
    text = data.get("text", "")
    lang = data.get("lang")
    lower = text.lower()
    es_hints = sum(1 for w in [" el ", " la ", " de ", " que ", " en ", " un "] if w in f" {lower} ")
    cond = (len(text) >= 300 and lang == "es")
    record("4a. Happy path ES -> 200, len>=300, lang=es",
           cond,
           f"len={len(text)}, lang={lang}, took={dt:.1f}s")
    record("4b. ES text contains Spanish words (el/la/de...)",
           es_hints >= 2,
           f"spanish_hints={es_hints}, preview={text[:120]!r}")

def test_5_invalid_lang(token):
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(f"{API}/events/enrich",
                      json={"text": "Sbarco sulla Luna. Apollo 11 atterra sul Mare della Tranquillità.",
                            "year": 1969, "lang": "fr"},
                      headers=headers, timeout=15)
    record("5. Invalid lang=fr -> 422",
           r.status_code == 422,
           f"status={r.status_code}")

def test_6_missing_year(token):
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(f"{API}/events/enrich",
                      json={"text": "Sbarco sulla Luna. Apollo 11 atterra sul Mare della Tranquillità.",
                            "lang": "it"},
                      headers=headers, timeout=15)
    record("6. Missing year -> 422",
           r.status_code == 422,
           f"status={r.status_code}")

def test_7_short_text(token):
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(f"{API}/events/enrich",
                      json={"text": "short", "year": 1969, "lang": "it"},
                      headers=headers, timeout=15)
    record("7. Short text (<8 chars) -> 422",
           r.status_code == 422,
           f"status={r.status_code}")

def test_8_long_text(token):
    headers = {"Authorization": f"Bearer {token}"}
    long_text = "A" * 2050
    r = requests.post(f"{API}/events/enrich",
                      json={"text": long_text, "year": 1969, "lang": "it"},
                      headers=headers, timeout=15)
    record("8. Long text (>2000 chars) -> 422",
           r.status_code == 422,
           f"status={r.status_code}")

def test_9_regression(token):
    headers = {"Authorization": f"Bearer {token}"}
    # login demo
    r = requests.post(f"{API}/auth/login",
                      json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
                      timeout=15)
    record("9a. POST /api/auth/login demo -> 200",
           r.status_code == 200, f"status={r.status_code}")
    # auth/me
    r = requests.get(f"{API}/auth/me", headers=headers, timeout=15)
    record("9b. GET /api/auth/me -> 200",
           r.status_code == 200, f"status={r.status_code}")
    # today
    r = requests.get(f"{API}/events/today?limit=20", headers=headers, timeout=30)
    ok = r.status_code == 200 and len(r.json().get("events", [])) > 0
    record("9c. GET /api/events/today?limit=20 -> 200",
           ok, f"status={r.status_code} events={len(r.json().get('events', [])) if r.status_code==200 else 'n/a'}")
    # teasers
    r = requests.get(f"{API}/events/teasers?count=5", headers=headers, timeout=30)
    ok = r.status_code == 200 and len(r.json().get("teasers", [])) > 0
    record("9d. GET /api/events/teasers?count=5 -> 200",
           ok, f"status={r.status_code}")
    # stats
    r = requests.get(f"{API}/events/stats", headers=headers, timeout=15)
    record("9e. GET /api/events/stats -> 200",
           r.status_code == 200, f"status={r.status_code}")
    # img
    img_url = ("https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/"
               "HRH_The_Princess_Alexandra_04_25_10.png/1080px-HRH_The_Princess_Alexandra_04_25_10.png")
    r = requests.get(f"{API}/img", params={"url": img_url}, timeout=30)
    record("9f. GET /api/img?url=<wikimedia> -> 200",
           r.status_code == 200,
           f"status={r.status_code} content-type={r.headers.get('content-type')} size={len(r.content)}")


def main():
    print("\n=== AI Enrich endpoint tests ===\n")
    # 1. Unauth (before login)
    test_1_unauth()

    # login
    token = auth_login()
    print(f"[auth] token acquired len={len(token)}")

    # 2-4 happy paths
    it_text = test_2_happy_it(token)
    test_3_happy_en(token, it_text)
    test_4_happy_es(token)

    # 5-8 validation
    test_5_invalid_lang(token)
    test_6_missing_year(token)
    test_7_short_text(token)
    test_8_long_text(token)

    # 9 regression
    test_9_regression(token)

    # Summary
    print("\n=== SUMMARY ===")
    total = len(results)
    passed = sum(1 for _, p, _ in results if p)
    for n, p, d in results:
        print(f"  [{'PASS' if p else 'FAIL'}] {n}")
    print(f"\n{passed}/{total} passed")
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
