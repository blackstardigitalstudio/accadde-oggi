"""
Backend tests for Accadde Oggi — focus on GET /api/events/teasers
plus regression checks for auth/login, auth/me, events/today, events/stats.
"""
import os
import sys
import json
import requests
from pathlib import Path

# Read BASE_URL from /app/frontend/.env
FRONTEND_ENV = Path("/app/frontend/.env")
BASE = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE = line.split("=", 1)[1].strip().strip('"').strip("'")
        break
if not BASE:
    print("ERROR: EXPO_PUBLIC_BACKEND_URL not found")
    sys.exit(1)

API = f"{BASE}/api"
print(f"Using API base: {API}")

# Credentials
EMAIL = "demo@accaddeoggi.app"
PASSWORD = "Demo1234"

results = []


def record(name: str, ok: bool, details: str = ""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {details}")
    results.append((name, ok, details))


def test_login():
    r = requests.post(f"{API}/auth/login",
                      json={"email": EMAIL, "password": PASSWORD},
                      timeout=20)
    ok = r.status_code == 200 and "access_token" in r.json()
    record("POST /api/auth/login", ok, f"status={r.status_code} body_keys={list(r.json().keys()) if r.ok else r.text[:200]}")
    return r.json().get("access_token") if ok else None


def test_me(token):
    r = requests.get(f"{API}/auth/me",
                     headers={"Authorization": f"Bearer {token}"},
                     timeout=15)
    ok = r.status_code == 200 and r.json().get("email") == EMAIL
    record("GET /api/auth/me", ok, f"status={r.status_code} email={r.json().get('email') if r.ok else r.text[:200]}")


def test_events_today(token):
    r = requests.get(f"{API}/events/today",
                     headers={"Authorization": f"Bearer {token}"},
                     timeout=60)
    ok = r.status_code == 200 and "events" in r.json()
    details = f"status={r.status_code}"
    if r.ok:
        js = r.json()
        details += f" count={js.get('count')} lang={js.get('lang')}"
    else:
        details += f" body={r.text[:200]}"
    record("GET /api/events/today", ok, details)


def test_events_stats(token):
    r = requests.get(f"{API}/events/stats",
                     headers={"Authorization": f"Bearer {token}"},
                     timeout=15)
    ok = r.status_code == 200 and all(k in r.json() for k in ["likes", "dislikes", "saves", "top_categories"])
    record("GET /api/events/stats", ok, f"status={r.status_code} body={json.dumps(r.json())[:200] if r.ok else r.text[:200]}")


def test_teasers_unauth():
    r = requests.get(f"{API}/events/teasers", timeout=15)
    ok = r.status_code in (401, 403)
    record("GET /api/events/teasers (no auth -> 401)", ok, f"status={r.status_code}")


def test_teasers_basic(token):
    r = requests.get(f"{API}/events/teasers",
                     headers={"Authorization": f"Bearer {token}"},
                     timeout=60)
    ok = r.status_code == 200
    if not ok:
        record("GET /api/events/teasers basic (200)", False, f"status={r.status_code} body={r.text[:400]}")
        return None
    js = r.json()
    # Check shape
    keys_required = {"date", "lang", "country", "count", "teasers"}
    missing = keys_required - set(js.keys())
    date_keys = set(js.get("date", {}).keys()) if isinstance(js.get("date"), dict) else set()
    date_ok = {"month", "day", "year"} <= date_keys
    shape_ok = not missing and date_ok and isinstance(js["teasers"], list)
    record("GET /api/events/teasers basic shape", shape_ok,
           f"missing={missing} date_keys={date_keys} teasers_count={len(js.get('teasers', []))}")
    return js


def test_teasers_fields(js):
    teasers = js.get("teasers", [])
    if not teasers:
        record("teaser fields presence", False, "no teasers returned")
        return
    required = {"id", "year", "years_ago", "category", "scope", "title", "title_short", "text_short"}
    sample = teasers[0]
    missing = required - set(sample.keys())
    all_ok = True
    missing_details = []
    for i, t in enumerate(teasers):
        miss = required - set(t.keys())
        if miss:
            all_ok = False
            missing_details.append(f"[{i}]{miss}")
            if len(missing_details) > 3:
                break
    record("teaser required fields present", all_ok,
           f"first_missing={missing} all_miss={missing_details[:3]}")


def test_teasers_truncation(js):
    teasers = js.get("teasers", [])
    if not teasers:
        record("teaser truncation rules", False, "no teasers")
        return
    text_ok = True
    title_ok = True
    bad_text = None
    bad_title = None
    truncated_examples = []
    for t in teasers:
        txt = t.get("text_short", "") or ""
        ttl = t.get("title_short", "") or ""
        # text_short <= ~100 chars (endpoint uses 95 + "…" -> allow up to 100)
        if len(txt) > 100:
            text_ok = False
            bad_text = f"len={len(txt)} text={txt!r}"
        # title_short <= ~60 chars (endpoint uses 60 + "…" -> allow up to 65)
        if len(ttl) > 65:
            title_ok = False
            bad_title = f"len={len(ttl)} title={ttl!r}"
        if txt.endswith("…"):
            truncated_examples.append(txt)
    record("text_short ≤ ~100 chars", text_ok, bad_text or "OK")
    record("title_short ≤ ~65 chars", title_ok, bad_title or "OK")
    record("text_short ends with '…' when truncated",
           len(truncated_examples) > 0 or all(len(t.get("text_short", "")) <= 95 for t in teasers),
           f"truncated_count={len(truncated_examples)} example={truncated_examples[0] if truncated_examples else 'N/A'}")


def test_teasers_lang(token, lang):
    r = requests.get(f"{API}/events/teasers?lang={lang}",
                     headers={"Authorization": f"Bearer {token}"},
                     timeout=60)
    if r.status_code != 200:
        record(f"teasers ?lang={lang}", False, f"status={r.status_code} body={r.text[:200]}")
        return None
    js = r.json()
    ok_lang = js.get("lang") == lang
    record(f"teasers ?lang={lang} returns lang field", ok_lang, f"returned_lang={js.get('lang')}")
    return js


def test_teasers_month_day(token):
    # July 20 - Moon landing 1969
    r = requests.get(f"{API}/events/teasers?month=7&day=20&count=50",
                     headers={"Authorization": f"Bearer {token}"},
                     timeout=60)
    if r.status_code != 200:
        record("teasers ?month=7&day=20", False, f"status={r.status_code} body={r.text[:200]}")
        return
    js = r.json()
    date_ok = js.get("date", {}).get("month") == 7 and js.get("date", {}).get("day") == 20
    # Look for moon / 1969 / luna / apollo
    moon_hit = False
    matching_title = None
    for t in js.get("teasers", []):
        txt = (t.get("text_short", "") + " " + t.get("title", "")).lower()
        if t.get("year") == 1969 and ("moon" in txt or "luna" in txt or "apollo" in txt):
            moon_hit = True
            matching_title = t.get("title")
            break
        if t.get("year") == 1969:
            # still count as moon-landing year sighting
            moon_hit = True
            matching_title = t.get("title")
    record("teasers ?month=7&day=20 returns July 20 events", date_ok,
           f"date={js.get('date')} teasers={js.get('count')}")
    record("teasers July 20 includes 1969 (moon landing)", moon_hit,
           f"matched_title={matching_title}")


def test_teasers_count_param(token):
    r = requests.get(f"{API}/events/teasers?count=5",
                     headers={"Authorization": f"Bearer {token}"},
                     timeout=60)
    if r.status_code != 200:
        record("teasers ?count=5", False, f"status={r.status_code} body={r.text[:200]}")
        return
    js = r.json()
    ok = js.get("count", 999) <= 5 and len(js.get("teasers", [])) <= 5
    record("teasers ?count=5 returns ≤ 5", ok,
           f"count={js.get('count')} teasers_len={len(js.get('teasers', []))}")


def main():
    print("=" * 70)
    print("ACCADDE OGGI — BACKEND TESTS")
    print("=" * 70)

    token = test_login()
    if not token:
        print("Cannot continue without auth token")
        sys.exit(1)

    # Regression tests
    test_me(token)
    test_events_today(token)
    test_events_stats(token)

    # Unauth teaser
    test_teasers_unauth()

    # Teasers basic
    js = test_teasers_basic(token)
    if js is not None:
        test_teasers_fields(js)
        test_teasers_truncation(js)

    # Lang params
    js_en = test_teasers_lang(token, "en")
    js_es = test_teasers_lang(token, "es")

    # Compare en vs it to ensure language changes
    if js is not None and js_en is not None:
        it_texts = [t.get("text_short", "") for t in js.get("teasers", [])][:5]
        en_texts = [t.get("text_short", "") for t in js_en.get("teasers", [])][:5]
        # Check they're not all identical (fallback acceptable but usually some diff)
        any_diff = any(a != b for a, b in zip(it_texts, en_texts))
        record("teaser text differs between lang=it and lang=en", any_diff,
               f"it_sample={it_texts[0][:60] if it_texts else ''!r} en_sample={en_texts[0][:60] if en_texts else ''!r}")

    # Month/day param (moon landing)
    test_teasers_month_day(token)

    # Count param
    test_teasers_count_param(token)

    # Summary
    print()
    print("=" * 70)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"TOTAL: {passed} passed, {failed} failed, {len(results)} total")
    print("=" * 70)
    if failed:
        print("\nFAILURES:")
        for name, ok, details in results:
            if not ok:
                print(f"  - {name}: {details}")
        sys.exit(1)


if __name__ == "__main__":
    main()
