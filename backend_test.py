"""
Backend test for Accadde Oggi - Password recovery + security question endpoints + regression.

Tests the review request:
A) POST /api/auth/register with security_question + security_answer
B) POST /api/auth/forgot/question
C) POST /api/auth/forgot/reset (incl. session invalidation of old tokens)
D) PATCH /api/auth/security-question (auth required)
E) Regression: /auth/login, /auth/me, /events/today, /events/teasers, /events/stats, /img
"""
import time
import sys
from pathlib import Path

import requests

# Read EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env
ENV_PATH = Path("/app/frontend/.env")
BASE_URL = None
for line in ENV_PATH.read_text().splitlines():
    line = line.strip()
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
        break

if not BASE_URL:
    print("FATAL: EXPO_PUBLIC_BACKEND_URL not found in /app/frontend/.env")
    sys.exit(1)

API = f"{BASE_URL}/api"
print(f"API base: {API}")

TS = int(time.time())
USER_A_EMAIL = f"test-secq-{TS}@test.app"
USER_A_PASSWORD = "InitPass123!"
USER_A_NEW_PASSWORD = "NewPass123!"
USER_A_NAME = "Giulia Rossi"
USER_A_QUESTION = "Nome del tuo primo animale?"
USER_A_ANSWER = "Fido"

USER_B_EMAIL = f"test-nosecq-{TS}@test.app"
USER_B_PASSWORD = "NoQPass123!"
USER_B_NAME = "Marco Bianchi"

DEMO_EMAIL = "demo@accaddeoggi.app"
DEMO_PASSWORD = "Demo1234"

results = []  # (name, passed, detail)


def record(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name} {('- ' + detail) if detail else ''}")
    results.append((name, cond, detail))
    return cond


def j(resp):
    try:
        return resp.json()
    except Exception:
        return {"_raw": resp.text[:200]}


# =======================================================
# A) REGISTER
# =======================================================
print("\n=== A) POST /api/auth/register ===")

r = requests.post(f"{API}/auth/register", json={
    "email": USER_A_EMAIL,
    "password": USER_A_PASSWORD,
    "name": USER_A_NAME,
    "language": "it",
    "country": "IT",
    "security_question": USER_A_QUESTION,
    "security_answer": USER_A_ANSWER,
}, timeout=30)
data = j(r)
record("A1: register with security_question returns 200",
       r.status_code == 200, f"status={r.status_code} body={data}")

access_A = data.get("access_token")
refresh_A = data.get("refresh_token")
user_A = data.get("user") or {}

record("A2a: response contains access_token", bool(access_A))
record("A2b: response contains refresh_token", bool(refresh_A))
record("A2c: user has required fields",
       all(k in user_A for k in ("id", "email", "name", "role", "language", "country")),
       f"user_keys={list(user_A.keys())}")
record("A2d: user.has_security_question === true",
       user_A.get("has_security_question") is True,
       f"has_security_question={user_A.get('has_security_question')}")

r = requests.post(f"{API}/auth/register", json={
    "email": USER_B_EMAIL,
    "password": USER_B_PASSWORD,
    "name": USER_B_NAME,
    "language": "it",
    "country": "IT",
}, timeout=30)
data_B = j(r)
record("A3a: register without security_question returns 200",
       r.status_code == 200, f"status={r.status_code}")
user_B = data_B.get("user") or {}
record("A3b: user.has_security_question === false",
       user_B.get("has_security_question") is False,
       f"has_security_question={user_B.get('has_security_question')}")

# =======================================================
# B) FORGOT / QUESTION
# =======================================================
print("\n=== B) POST /api/auth/forgot/question ===")

r = requests.post(f"{API}/auth/forgot/question",
                  json={"email": USER_A_EMAIL}, timeout=30)
body = j(r)
record("B4a: forgot/question returns 200 for user with security question",
       r.status_code == 200, f"status={r.status_code} body={body}")
record("B4b: response question matches what was set",
       body.get("question") == USER_A_QUESTION, f"question={body.get('question')}")

r = requests.post(f"{API}/auth/forgot/question",
                  json={"email": "nobody@nowhere.com"}, timeout=30)
record("B5: unknown email returns 404",
       r.status_code == 404, f"status={r.status_code} body={j(r)}")

r = requests.post(f"{API}/auth/forgot/question",
                  json={"email": USER_B_EMAIL}, timeout=30)
body6 = j(r)
record("B6a: user without security question returns 404",
       r.status_code == 404, f"status={r.status_code}")
detail_txt = str(body6.get("detail", "")).lower()
leaks = any(k in detail_txt for k in ["not set", "missing question", "no question set"])
record("B6b: error message is generic (no email-existence leak)",
       not leaks, f"detail={body6.get('detail')}")

# =======================================================
# C) FORGOT / RESET
# =======================================================
print("\n=== C) POST /api/auth/forgot/reset ===")

old_access_A = access_A

# C9: wrong answer → 401
r = requests.post(f"{API}/auth/forgot/reset", json={
    "email": USER_A_EMAIL, "answer": "WrongAnswer",
    "new_password": "SomeBogus1!",
}, timeout=30)
record("C9: wrong answer returns 401",
       r.status_code == 401, f"status={r.status_code} body={j(r)}")

# Wait so password_changed_at > iat + 1s
time.sleep(2.5)

# C8: uppercase answer (case-insensitive)
r = requests.post(f"{API}/auth/forgot/reset", json={
    "email": USER_A_EMAIL, "answer": USER_A_ANSWER.upper(),
    "new_password": USER_A_NEW_PASSWORD,
}, timeout=30)
body8 = j(r)
record("C8a: uppercase answer succeeds (case-insensitive) 200",
       r.status_code == 200, f"status={r.status_code} body={body8}")
record("C8b: response contains ok:true",
       body8.get("ok") is True, f"body={body8}")

# C10a: login with OLD password must fail
r = requests.post(f"{API}/auth/login", json={
    "email": USER_A_EMAIL, "password": USER_A_PASSWORD,
}, timeout=30)
record("C10a: login with old password fails (401)",
       r.status_code == 401, f"status={r.status_code}")

# C10b: login with NEW password must succeed
r = requests.post(f"{API}/auth/login", json={
    "email": USER_A_EMAIL, "password": USER_A_NEW_PASSWORD,
}, timeout=30)
body10 = j(r)
record("C10b: login with new password succeeds (200)",
       r.status_code == 200, f"status={r.status_code}")

# C11: OLD access token must be rejected (session invalidation)
r = requests.get(f"{API}/auth/me",
                 headers={"Authorization": f"Bearer {old_access_A}"}, timeout=30)
b11 = j(r)
detail11 = str(b11.get("detail", "")).lower()
record("C11a: old access token rejected with 401",
       r.status_code == 401, f"status={r.status_code} body={b11}")
record("C11b: detail mentions session invalidated",
       "invalidated" in detail11 or "session" in detail11,
       f"detail={b11.get('detail')}")

# C7: exact-case answer reset (another reset using same answer, lowercase "fido")
time.sleep(1.5)
r = requests.post(f"{API}/auth/forgot/reset", json={
    "email": USER_A_EMAIL, "answer": USER_A_ANSWER,  # "Fido"
    "new_password": USER_A_NEW_PASSWORD,
}, timeout=30)
b7 = j(r)
record("C7: exact-case answer reset returns 200 + {ok:true}",
       r.status_code == 200 and b7.get("ok") is True,
       f"status={r.status_code} body={b7}")

# =======================================================
# D) PATCH /api/auth/security-question (auth required)
# =======================================================
print("\n=== D) PATCH /api/auth/security-question ===")

# D14: without auth → 401
r = requests.patch(f"{API}/auth/security-question", json={
    "current_password": DEMO_PASSWORD,
    "question": "Città di nascita?",
    "answer": "Milano",
}, timeout=30)
record("D14: PATCH without auth returns 401 (or 403)",
       r.status_code in (401, 403), f"status={r.status_code}")

# login as demo
r = requests.post(f"{API}/auth/login",
                  json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=30)
demo_access = None
if r.status_code == 200:
    record("D-pre: demo login OK", True)
    demo_access = r.json().get("access_token")
else:
    record("D-pre: demo login", False,
           f"status={r.status_code} body={j(r)}")

if demo_access:
    # D12
    r = requests.patch(f"{API}/auth/security-question",
                       headers={"Authorization": f"Bearer {demo_access}"},
                       json={
                           "current_password": DEMO_PASSWORD,
                           "question": "Città di nascita?",
                           "answer": "Milano",
                       }, timeout=30)
    b12 = j(r)
    record("D12a: PATCH with correct password returns 200",
           r.status_code == 200, f"status={r.status_code} body={b12}")

    r = requests.get(f"{API}/auth/me",
                     headers={"Authorization": f"Bearer {demo_access}"}, timeout=30)
    me_body = j(r)
    record("D12b: /auth/me has_security_question === true",
           me_body.get("has_security_question") is True,
           f"me={me_body}")

    # D13: wrong current_password → 401
    r = requests.patch(f"{API}/auth/security-question",
                       headers={"Authorization": f"Bearer {demo_access}"},
                       json={
                           "current_password": "WrongPassword!",
                           "question": "X?",
                           "answer": "yy",
                       }, timeout=30)
    record("D13: wrong current_password returns 401",
           r.status_code == 401, f"status={r.status_code} body={j(r)}")

# =======================================================
# E) REGRESSION
# =======================================================
print("\n=== E) REGRESSION ===")

r = requests.post(f"{API}/auth/login",
                  json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=30)
record("E-demo: demo can still login after test D",
       r.status_code == 200, f"status={r.status_code}")
demo_tok = r.json().get("access_token") if r.status_code == 200 else None

if demo_tok:
    headers = {"Authorization": f"Bearer {demo_tok}"}

    r = requests.get(f"{API}/auth/me", headers=headers, timeout=30)
    record("E-me: GET /api/auth/me", r.status_code == 200, f"status={r.status_code}")

    r = requests.get(f"{API}/events/today?limit=20&lang=it", headers=headers, timeout=30)
    b = j(r) if r.status_code == 200 else {}
    events = b.get("events") if isinstance(b, dict) else None
    record("E-today: GET /api/events/today returns 200 with events",
           r.status_code == 200 and isinstance(events, list) and len(events) > 0,
           f"status={r.status_code} n_events={len(events) if isinstance(events, list) else 'n/a'}")

    r = requests.get(f"{API}/events/teasers?count=5&lang=it", headers=headers, timeout=30)
    b = j(r) if r.status_code == 200 else {}
    teasers = b.get("teasers") if isinstance(b, dict) else None
    record("E-teasers: GET /api/events/teasers?count=5",
           r.status_code == 200 and isinstance(teasers, list) and 0 < len(teasers) <= 5,
           f"status={r.status_code} n_teasers={len(teasers) if isinstance(teasers, list) else 'n/a'}")

    r = requests.get(f"{API}/events/stats", headers=headers, timeout=30)
    record("E-stats: GET /api/events/stats",
           r.status_code == 200, f"status={r.status_code}")

wiki_url = ("https://upload.wikimedia.org/wikipedia/commons/thumb/"
            "4/47/PNG_transparency_demonstration_1.png/"
            "280px-PNG_transparency_demonstration_1.png")
r = requests.get(f"{API}/img", params={"url": wiki_url}, timeout=30)
ctype = r.headers.get("content-type", "")
record("E-img: /api/img with valid wikimedia URL returns image",
       r.status_code == 200 and ctype.startswith("image/") and len(r.content) > 100,
       f"status={r.status_code} ctype={ctype} bytes={len(r.content)}")

# =======================================================
# SUMMARY
# =======================================================
print("\n" + "=" * 60)
passed = sum(1 for _, ok, _ in results if ok)
failed = [(n, d) for n, ok, d in results if not ok]
print(f"Total: {len(results)}  Passed: {passed}  Failed: {len(failed)}")
if failed:
    print("\nFAILED:")
    for n, d in failed:
        print(f"  - {n}: {d}")
    sys.exit(1)
print("ALL PASSED")
sys.exit(0)
