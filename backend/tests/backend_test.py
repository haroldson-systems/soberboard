"""SoberBoard backend regression tests.

Covers:
- Public listings + filtering
- Listing detail
- Auth: register/login/me/logout (JWT cookie)
- Auth-gated endpoints: /listings/mine, create/deactivate/reactivate
- Soft-archive enforcement (no hard delete)
- Cross-user 403 on deactivate/reactivate
- Jobs, Services, Ads, Reflection, Stats
"""
import os
import uuid
import pytest
import requests
from pathlib import Path

# Load REACT_APP_BACKEND_URL from frontend/.env so we hit the same public ingress
FRONTEND_ENV = Path(__file__).resolve().parents[2] / "frontend" / ".env"
if FRONTEND_ENV.exists():
    for line in FRONTEND_ENV.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            os.environ.setdefault("REACT_APP_BACKEND_URL", line.split("=", 1)[1].strip())

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

MANAGER = {"email": "manager@soberboard.com", "password": "manager123"}


@pytest.fixture(scope="session")
def manager_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=MANAGER, timeout=30)
    assert r.status_code == 200, f"manager login failed: {r.status_code} {r.text}"
    assert "access_token" in s.cookies, "access_token cookie not set"
    return s


@pytest.fixture(scope="session")
def other_session():
    """A second freshly-registered user used for 403 cross-user checks."""
    s = requests.Session()
    email = f"TEST_other_{uuid.uuid4().hex[:8]}@x.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "p123456", "name": "Other"}, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return s


# -------------------- Public listings --------------------
class TestPublicListings:
    def test_list_returns_15_seeded(self):
        r = requests.get(f"{API}/listings", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Could be >=15 if other tests created listings; demo manager seeds 15
        assert len(data) >= 15
        for item in data[:3]:
            assert "listing_id" in item and "house_name" in item
            assert "_id" not in item  # ObjectId must be stripped

    def test_filter_by_city(self):
        r = requests.get(f"{API}/listings", params={"city": "Garden Grove"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all("garden grove" in d["city"].lower() for d in data)

    def test_filter_by_zip(self):
        r = requests.get(f"{API}/listings", params={"zip_code": "92840"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(d["zip_code"] == "92840" for d in data)

    def test_filter_by_gender_men(self):
        r = requests.get(f"{API}/listings", params={"gender": "men"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(d["gender"] in ("men", "any", "coed") for d in data)

    def test_filter_by_pets(self):
        r = requests.get(f"{API}/listings", params={"pets": "true"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(d["pets_allowed"] is True for d in data)

    def test_filter_by_max_price(self):
        r = requests.get(f"{API}/listings", params={"max_price": 200}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        for d in data:
            ok = (d.get("price_weekly") is not None and d["price_weekly"] <= 200) or (
                d.get("price_monthly") is not None and d["price_monthly"] <= 800
            )
            assert ok, d

    def test_search_q_newport(self):
        r = requests.get(f"{API}/listings", params={"q": "newport"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert any("newport" in (d["house_name"] + d["city"] + d["description"]).lower() for d in data)

    def test_get_listing_detail(self):
        listings = requests.get(f"{API}/listings", timeout=30).json()
        first_id = listings[0]["listing_id"]
        r = requests.get(f"{API}/listings/{first_id}", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["listing_id"] == first_id
        assert "manager_phone" in d
        assert "_id" not in d

    def test_get_listing_404(self):
        r = requests.get(f"{API}/listings/lst_nonexistent", timeout=30)
        assert r.status_code == 404


# -------------------- Auth --------------------
class TestAuth:
    def test_register_login_me_logout(self):
        s = requests.Session()
        email = f"test_reg_{uuid.uuid4().hex[:8]}@x.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "p123456", "name": "Reg User"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == email.lower()
        assert body["role"] == "manager"
        assert "password_hash" not in body
        assert "_id" not in body
        # Cookies set
        assert "access_token" in s.cookies
        assert "refresh_token" in s.cookies

        # /me with cookie
        r = s.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == email

        # logout clears cookie
        r = s.post(f"{API}/auth/logout", timeout=30)
        assert r.status_code == 200

        # New session without cookies => 401
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_register_duplicate_400(self):
        r = requests.post(f"{API}/auth/register", json={**MANAGER, "name": "dup"}, timeout=30)
        assert r.status_code == 400

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": MANAGER["email"], "password": "wrong"}, timeout=30)
        assert r.status_code in (401, 429)  # 429 if a previous run already locked

    def test_manager_login_success(self, manager_session):
        r = manager_session.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == MANAGER["email"]
        assert u["user_id"] == "user_demo00manager"

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401


# -------------------- Manager listings + soft archive --------------------
class TestManagerListings:
    def test_listings_mine_returns_15(self, manager_session):
        r = manager_session.get(f"{API}/listings/mine", timeout=30)
        assert r.status_code == 200
        items = r.json()
        # demo seeded 15; tests may add more but never delete
        assert len([i for i in items if i["status"] in ("active", "inactive", "expired")]) >= 15

    def test_create_listing_active_with_expiry(self, manager_session):
        payload = {
            "house_name": f"TEST_house_{uuid.uuid4().hex[:6]}",
            "city": "Testville",
            "zip_code": "90001",
            "beds_open": 2,
            "price_weekly": 150,
            "price_monthly": 600,
            "people_per_room": 2,
            "gender": "any",
            "pets_allowed": False,
            "pool": False,
            "parking": "street",
            "amenities": ["WiFi"],
            "description": "test listing",
            "manager_name": "Tester",
            "manager_phone": "555-1234",
        }
        r = manager_session.post(f"{API}/listings", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "active"
        assert d["user_id"] == "user_demo00manager"
        assert d["expires_at"] > d["created_at"]
        # ~7 days expiry (allow drift)
        from datetime import datetime
        delta = datetime.fromisoformat(d["expires_at"]) - datetime.fromisoformat(d["created_at"])
        assert 6.5 < delta.total_seconds() / 86400 < 7.5
        pytest.created_listing_id = d["listing_id"]

    def test_deactivate_then_reactivate_soft_archive(self, manager_session):
        lid = pytest.created_listing_id
        # deactivate
        r = manager_session.post(f"{API}/listings/{lid}/deactivate", timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "inactive"
        # Soft archive — record still exists via /listings/{id}
        r = requests.get(f"{API}/listings/{lid}", timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "inactive"
        # Public list excludes inactive
        public = requests.get(f"{API}/listings", timeout=30).json()
        assert all(p["listing_id"] != lid for p in public)
        # Reactivate
        r = manager_session.post(f"{API}/listings/{lid}/reactivate", timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "active"
        # Detail confirms active + new expires_at
        d = requests.get(f"{API}/listings/{lid}", timeout=30).json()
        assert d["status"] == "active"

    def test_other_user_cannot_modify(self, other_session):
        # Get one of the manager's listings
        all_listings = requests.get(f"{API}/listings", timeout=30).json()
        target = next(l for l in all_listings if l["user_id"] == "user_demo00manager")
        lid = target["listing_id"]
        r = other_session.post(f"{API}/listings/{lid}/deactivate", timeout=30)
        assert r.status_code == 403
        r = other_session.post(f"{API}/listings/{lid}/reactivate", timeout=30)
        assert r.status_code == 403

    def test_listings_mine_unauth(self):
        r = requests.get(f"{API}/listings/mine", timeout=30)
        assert r.status_code == 401


# -------------------- Jobs / Services / Ads / Reflection / Stats --------------------
class TestSecondaryEndpoints:
    def test_jobs_returns_10(self):
        r = requests.get(f"{API}/jobs", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 10
        assert "title" in data[0]

    def test_services_returns_10(self):
        r = requests.get(f"{API}/services", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 10

    def test_services_filter_mental_health(self):
        r = requests.get(f"{API}/services", params={"category": "Mental Health"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(d["category"] == "Mental Health" for d in data)

    def test_ads_slot_filter(self):
        r = requests.get(f"{API}/ads", params={"slot": "sidebar"}, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(a["slot"] == "sidebar" for a in data)

        r2 = requests.get(f"{API}/ads", params={"slot": "inline"}, timeout=30)
        assert r2.status_code == 200
        data2 = r2.json()
        assert len(data2) >= 1
        assert all(a["slot"] == "inline" for a in data2)

    def test_reflection_today(self):
        r = requests.get(f"{API}/reflection/today", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("title", "body", "source", "date"):
            assert k in d

    def test_stats(self):
        r = requests.get(f"{API}/stats", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["active_listings"] >= 1
        assert d["total_open_beds"] >= 1
        assert d["cities_covered"] >= 1
