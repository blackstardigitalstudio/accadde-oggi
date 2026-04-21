"""Backend tests for /api/img proxy endpoint + regression of auth/events endpoints."""
import sys
import time
import requests

BASE = "https://memoria-giorno.preview.emergentagent.com"
API = f"{BASE}/api"

EMAIL = "demo@accaddeoggi.app"
PASSWORD = "Demo1234"

results = []


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} — {detail}")


def test_img_valid_wikimedia():
    name = "/api/img valid Wikimedia URL returns 200 + image/* + Cache-Control"
    wiki = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Prince_1981_%28crop%29.jpg/1080px-Prince_1981_%28crop%29.jpg"
    r = requests.get(f"{API}/img", params={"url": wiki}, timeout=30)
    ct = r.headers.get("content-type", "")
    cc = r.headers.get("cache-control", "")
    ok = (
        r.status_code == 200
        and ct.startswith("image/")
        and bool(cc)
        and len(r.content) > 500
    )
    record(name, ok, f"status={r.status_code} ct={ct} cc={cc} size={len(r.content)}")


def test_img_non_wikimedia():
    name = "/api/img non-wikimedia URL returns 400"
    r = requests.get(f"{API}/img", params={"url": "https://evil.com/x.jpg"}, timeout=15)
    ok = r.status_code == 400
    record(name, ok, f"status={r.status_code} body={r.text[:120]}")


def test_img_missing_url():
    name = "/api/img missing url param returns 422"
    r = requests.get(f"{API}/img", timeout=15)
    ok = r.status_code == 422
    record(name, ok, f"status={r.status_code}")


def test_img_malformed_wikimedia():
    name = "/api/img malformed wikimedia URL: 200 fallback PNG OR valid image (never 500)"
    bad = "https://upload.wikimedia.org/wikipedia/commons/thumb/z/zz/DoesNotExist_AccaddeOggiTest_123456789.jpg/1080px-DoesNotExist_AccaddeOggiTest_123456789.jpg"
    r = requests.get(f"{API}/img", params={"url": bad}, timeout=30)
    ct = r.headers.get("content-type", "")
    cc = r.headers.get("cache-control", "")
    ok = r.status_code == 200 and ct.startswith("image/") and bool(cc)
    record(name, ok, f"status={r.status_code} ct={ct} cc={cc} size={len(r.content)}")


def test_img_cache_faster():
    name = "/api/img second call with same URL faster (cache hit)"
    wiki = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Prince_1981_%28crop%29.jpg/1080px-Prince_1981_%28crop%29.jpg"
    t0 = time.time()
    r1 = requests.get(f"{API}/img", params={"url": wiki}, timeout=30)
    t1 = time.time() - t0
    t2 = time.time()
    r2 = requests.get(f"{API}/img", params={"url": wiki}, timeout=30)
    t3 = time.time() - t2
    ok = (
        r1.status_code == 200
        and r2.status_code == 200
        and t3 <= t1 + 0.05  # second call at least as fast (+ small jitter tolerance)
    )
    record(name, ok, f"first={t1:.3f}s second={t3:.3f}s r1={r1.status_code} r2={r2.status_code}")


def test_img_no_auth_required():
    name = "/api/img is public (no auth header) — returns 200"
    wiki = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Prince_1981_%28crop%29.jpg/1080px-Prince_1981_%28crop%29.jpg"
    s = requests.Session()
    r = s.get(f"{API}/img", params={"url": wiki}, timeout=30)
    ok = r.status_code == 200 and r.headers.get("content-type", "").startswith("image/")
    record(name, ok, f"status={r.status_code}")


def test_regression():
    r = requests.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=20)
    ok = r.status_code == 200 and "access_token" in r.json()
    record("POST /api/auth/login", ok, f"status={r.status_code}")
    if not ok:
        return
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r2 = requests.get(f"{API}/events/today", params={"limit": 20}, headers=headers, timeout=60)
    ok2 = r2.status_code == 200 and "events" in r2.json()
    cnt2 = r2.json().get("count") if ok2 else None
    record("GET /api/events/today?limit=20", ok2, f"status={r2.status_code} count={cnt2}")

    r3 = requests.get(f"{API}/events/teasers", params={"count": 5}, headers=headers, timeout=60)
    ok3 = r3.status_code == 200 and "teasers" in r3.json()
    cnt3 = r3.json().get("count") if ok3 else None
    record("GET /api/events/teasers?count=5", ok3, f"status={r3.status_code} count={cnt3}")

    r4 = requests.get(f"{API}/events/stats", headers=headers, timeout=30)
    ok4 = r4.status_code == 200 and "likes" in r4.json()
    record("GET /api/events/stats", ok4, f"status={r4.status_code}")


def main():
    print(f"Base: {API}")
    test_img_valid_wikimedia()
    test_img_non_wikimedia()
    test_img_missing_url()
    test_img_malformed_wikimedia()
    test_img_cache_faster()
    test_img_no_auth_required()
    test_regression()

    print("\n=== SUMMARY ===")
    fails = [r for r in results if not r[1]]
    for name, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'}: {name} | {detail}")
    print(f"\nTotal: {len(results)}, Passed: {len(results) - len(fails)}, Failed: {len(fails)}")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
