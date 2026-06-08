from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import asyncio
import uuid
import logging
import secrets
import smtplib
import bcrypt
import jwt
import httpx
import cloudinary
import cloudinary.uploader
from email.message import EmailMessage
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, status, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# --- DB ---
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# --- App ---
app = FastAPI(title="SoberBoard API")
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
JWT_ACCESS_MINUTES = 60 * 24  # 1 day for convenience
JWT_REFRESH_DAYS = 7
LISTING_DURATION_DAYS = 7

# ============== AUTH HELPERS ==============
def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_ACCESS_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_REFRESH_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_jwt_cookies(response: Response, access: str, refresh: str):
    # Cross-site cookies need SameSite=None + Secure (preview is https)
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=JWT_ACCESS_MINUTES * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=JWT_REFRESH_DAYS * 86400, path="/")


def clear_auth_cookies(response: Response):
    for name in ("access_token", "refresh_token"):
        response.delete_cookie(name, path="/")


async def get_current_user(request: Request) -> dict:
    """Resolve user from JWT access_token cookie or Authorization header."""
    # 1. Try JWT
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if token:
        try:
            payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
            if payload.get("type") == "access":
                user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            pass

    raise HTTPException(status_code=401, detail="Not authenticated")


# ============== MODELS ==============
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    role: str = "manager"
    auth_provider: str = "password"
    picture: Optional[str] = None
    phone: Optional[str] = None


class ListingIn(BaseModel):
    house_name: str
    city: str
    state: str = "CA"
    region: str = "Orange County"
    zip_code: str
    beds_open: int = Field(ge=1, le=50)
    price_weekly: Optional[float] = None
    price_monthly: Optional[float] = None
    accepts_insurance: bool = False
    insurance_notes: str = ""
    people_per_room: int = Field(ge=1, le=8, default=2)
    gender: str = "any"  # men, women, couples, any, coed
    pets_allowed: bool = False
    pool: bool = False
    parking: str = "street"  # street, driveway, garage, none
    amenities: List[str] = []
    drug_testing: str = ""
    curfew: str = ""
    meeting_requirements: str = ""
    smoking_policy: str = ""
    house_rules: List[str] = []
    description: str = ""
    manager_name: str
    manager_phone: str
    image_urls: List[str] = []


class ListingOut(ListingIn):
    listing_id: str
    user_id: str
    status: str  # active | inactive | expired
    created_at: str
    updated_at: str
    expires_at: str
    image_url: Optional[str] = None


class ListingReportIn(BaseModel):
    reason: str
    details: str = ""
    contact_email: Optional[EmailStr] = None


class SavedSearchIn(BaseModel):
    name: str
    filters: Dict[str, Any] = Field(default_factory=dict)
    alerts_enabled: bool = True


# ============== CLOUDINARY IMAGE STORAGE ==============
MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "heic": "image/heic",
}
MAX_IMAGES_PER_LISTING = 6
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB
_cloudinary_configured = False


def init_cloudinary() -> bool:
    """Initialize Cloudinary from environment variables."""
    global _cloudinary_configured
    if _cloudinary_configured:
        return True
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME")
    api_key = os.environ.get("CLOUDINARY_API_KEY")
    api_secret = os.environ.get("CLOUDINARY_API_SECRET")
    if not all([cloud_name, api_key, api_secret]):
        return False
    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )
    _cloudinary_configured = True
    return True


def upload_to_cloudinary(data: bytes, public_id: str, content_type: str) -> str:
    """Upload image bytes to Cloudinary, return the secure URL."""
    if not init_cloudinary():
        raise HTTPException(status_code=503, detail="Image storage unavailable")
    import io
    result = cloudinary.uploader.upload(
        io.BytesIO(data),
        public_id=public_id,
        resource_type="image",
        folder="soberboard",
        overwrite=True,
    )
    return result["secure_url"]


# ============== AUTH ENDPOINTS ==============
@api_router.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": body.name.strip(),
        "password_hash": hash_password(body.password),
        "role": "manager",
        "auth_provider": "password",
        "picture": None,
        "phone": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    set_jwt_cookies(response, create_access_token(user_id, email), create_refresh_token(user_id))
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return user_doc


@api_router.post("/auth/login")
async def login(body: LoginIn, response: Response, request: Request):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = attempt.get("locked_until")
        if locked_until and locked_until > datetime.now(timezone.utc).isoformat():
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1},
             "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": identifier})
    set_jwt_cookies(response, create_access_token(user["user_id"], email), create_refresh_token(user["user_id"]))
    user.pop("password_hash", None)
    user.pop("_id", None)
    return user


@api_router.post("/auth/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ============== GOOGLE OAUTH ==============
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


def _google_client_id() -> Optional[str]:
    return os.environ.get("GOOGLE_CLIENT_ID")


def _google_client_secret() -> Optional[str]:
    return os.environ.get("GOOGLE_CLIENT_SECRET")


@api_router.get("/auth/google/url")
async def google_auth_url(redirect_uri: str = ""):
    """Return the Google OAuth consent URL for the frontend to redirect to."""
    client_id = _google_client_id()
    if not client_id:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    if not redirect_uri:
        redirect_uri = os.environ.get("FRONTEND_URL", "http://localhost:3000") + "/auth/callback"
    from urllib.parse import urlencode
    params = urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    })
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}"}


@api_router.post("/auth/google/callback")
async def google_callback(request: Request, response: Response):
    """Exchange Google auth code for tokens, create/login user, set JWT cookies."""
    body = await request.json()
    code = body.get("code")
    redirect_uri = body.get("redirect_uri", "")
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code required")
    client_id = _google_client_id()
    client_secret = _google_client_secret()
    if not client_id or not client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    if not redirect_uri:
        redirect_uri = os.environ.get("FRONTEND_URL", "http://localhost:3000") + "/auth/callback"

    # Exchange code for tokens
    async with httpx.AsyncClient(timeout=10.0) as http:
        token_resp = await http.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
    if token_resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to exchange authorization code")
    tokens = token_resp.json()
    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="No access token from Google")

    # Get user info
    async with httpx.AsyncClient(timeout=10.0) as http:
        info_resp = await http.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
    if info_resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to get user info from Google")
    info = info_resp.json()
    email = info.get("email", "").lower().strip()
    name = info.get("name") or email.split("@")[0]
    picture = info.get("picture")
    if not email:
        raise HTTPException(status_code=400, detail="No email from Google")

    # Create or update user
    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture, "auth_provider": existing.get("auth_provider", "google")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "manager",
            "auth_provider": "google",
            "password_hash": None,
            "phone": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Set JWT cookies (same as email/password login)
    set_jwt_cookies(response, create_access_token(user_id, email), create_refresh_token(user_id))
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return user


# ============== LISTINGS ==============
def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _expiry_iso(days: int = LISTING_DURATION_DAYS):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


async def _expire_stale():
    now = _now_iso()
    await db.listings.update_many(
        {"status": "active", "expires_at": {"$lt": now}},
        {"$set": {"status": "expired", "updated_at": now}},
    )


def build_listing_query(
    city: Optional[str] = None,
    state: Optional[str] = None,
    region: Optional[str] = None,
    zip_code: Optional[str] = None,
    gender: Optional[str] = None,
    pets: Optional[bool] = None,
    insurance: Optional[bool] = None,
    max_price: Optional[float] = None,
    q: Optional[str] = None,
    created_after: Optional[str] = None,
):
    and_clauses = [{"status": "active"}]
    if city:
        and_clauses.append({"city": {"$regex": city, "$options": "i"}})
    if state:
        and_clauses.append({"state": state.upper()})
    if region:
        and_clauses.append({"region": {"$regex": region, "$options": "i"}})
    if zip_code:
        and_clauses.append({"zip_code": zip_code})
    if gender and gender != "any":
        and_clauses.append({"gender": {"$in": [gender, "any", "coed"]}})
    if pets is True:
        and_clauses.append({"pets_allowed": True})
    if insurance is True:
        and_clauses.append({"accepts_insurance": True})
    if max_price is not None:
        and_clauses.append({"$or": [
            {"price_weekly": {"$lte": max_price}},
            {"price_monthly": {"$lte": max_price * 4}},
        ]})
    if q:
        and_clauses.append({"$or": [
            {"house_name": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
            {"region": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"insurance_notes": {"$regex": q, "$options": "i"}},
            {"meeting_requirements": {"$regex": q, "$options": "i"}},
            {"zip_code": {"$regex": f"^{q}", "$options": "i"}},
        ]})
    if created_after:
        and_clauses.append({"created_at": {"$gt": created_after}})
    return {"$and": and_clauses} if len(and_clauses) > 1 else and_clauses[0]


@api_router.get("/listings")
async def list_listings(
    city: Optional[str] = None,
    state: Optional[str] = None,
    region: Optional[str] = None,
    zip_code: Optional[str] = None,
    gender: Optional[str] = None,
    pets: Optional[bool] = None,
    insurance: Optional[bool] = None,
    max_price: Optional[float] = None,
    q: Optional[str] = None,
):
    await _expire_stale()
    query = build_listing_query(city, state, region, zip_code, gender, pets, insurance, max_price, q)
    items = await db.listings.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api_router.get("/regions")
async def list_regions():
    """Distinct (state, region) pairs across active listings — for filter UIs."""
    await _expire_stale()
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": {"state": "$state", "region": "$region"}, "count": {"$sum": 1}, "beds": {"$sum": "$beds_open"}}},
        {"$sort": {"count": -1}},
    ]
    rows = await db.listings.aggregate(pipeline).to_list(100)
    return [{"state": r["_id"]["state"], "region": r["_id"]["region"], "listings": r["count"], "beds": r["beds"]} for r in rows]


@api_router.get("/listings/mine")
async def my_listings(user: dict = Depends(get_current_user)):
    await _expire_stale()
    items = await db.listings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api_router.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    await _expire_stale()
    item = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Listing not found")
    return item


@api_router.post("/listings/{listing_id}/report")
async def report_listing(listing_id: str, body: ListingReportIn, request: Request):
    item = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0, "listing_id": 1, "house_name": 1, "manager_phone": 1})
    if not item:
        raise HTTPException(status_code=404, detail="Listing not found")
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Report reason is required")
    report_id = f"rpt_{uuid.uuid4().hex[:12]}"
    await db.listing_reports.insert_one({
        "report_id": report_id,
        "listing_id": listing_id,
        "house_name": item.get("house_name"),
        "reason": reason,
        "details": body.details.strip(),
        "contact_email": str(body.contact_email).lower() if body.contact_email else None,
        "status": "new",
        "ip": request.client.host if request.client else "unknown",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    })
    return {"ok": True, "report_id": report_id}


SAVED_SEARCH_FILTER_KEYS = {
    "q",
    "city",
    "state",
    "region",
    "gender",
    "pets",
    "insurance",
    "max_price",
}


def clean_saved_search_filters(filters: Dict[str, Any]) -> Dict[str, Any]:
    cleaned = {}
    for key, value in filters.items():
        if key not in SAVED_SEARCH_FILTER_KEYS:
            continue
        if value is None or value == "" or value == "any":
            continue
        if key in {"pets", "insurance"}:
            if isinstance(value, str):
                parsed = value.lower() in {"1", "true", "yes", "on"}
            else:
                parsed = bool(value)
            if parsed:
                cleaned[key] = True
        elif key == "max_price":
            try:
                cleaned[key] = float(value)
            except (TypeError, ValueError):
                continue
        else:
            cleaned[key] = str(value).strip()
    return cleaned


@api_router.get("/saved-searches")
async def list_saved_searches(user: dict = Depends(get_current_user)):
    items = await db.saved_searches.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


@api_router.post("/saved-searches")
async def create_saved_search(body: SavedSearchIn, user: dict = Depends(get_current_user)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Search name is required")
    filters = clean_saved_search_filters(body.filters)
    if not filters:
        raise HTTPException(status_code=400, detail="Choose at least one filter before saving")
    now = _now_iso()
    doc = {
        "saved_search_id": f"ss_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": name[:80],
        "filters": filters,
        "alerts_enabled": body.alerts_enabled,
        "last_alerted_at": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.saved_searches.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/saved-searches/{saved_search_id}")
async def update_saved_search(saved_search_id: str, body: SavedSearchIn, user: dict = Depends(get_current_user)):
    item = await db.saved_searches.find_one({"saved_search_id": saved_search_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Saved search not found")
    if item["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    name = body.name.strip()
    filters = clean_saved_search_filters(body.filters)
    if not name or not filters:
        raise HTTPException(status_code=400, detail="Search name and filters are required")
    await db.saved_searches.update_one(
        {"saved_search_id": saved_search_id},
        {"$set": {"name": name[:80], "filters": filters, "alerts_enabled": body.alerts_enabled, "updated_at": _now_iso()}},
    )
    return await db.saved_searches.find_one({"saved_search_id": saved_search_id}, {"_id": 0})


@api_router.delete("/saved-searches/{saved_search_id}")
async def delete_saved_search(saved_search_id: str, user: dict = Depends(get_current_user)):
    item = await db.saved_searches.find_one({"saved_search_id": saved_search_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Saved search not found")
    if item["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.saved_searches.delete_one({"saved_search_id": saved_search_id})
    return {"ok": True}


@api_router.post("/listings")
async def create_listing(body: ListingIn, user: dict = Depends(get_current_user)):
    listing_id = f"lst_{uuid.uuid4().hex[:12]}"
    doc = body.model_dump()
    # Backfill state/region from zip/city if the operator left defaults
    if not doc.get("region") or doc.get("region") == "Orange County":
        inferred_state, inferred_region = infer_region(doc.get("city", ""), doc.get("zip_code", ""))
        if not doc.get("state") or doc.get("state") == "CA":
            doc["state"] = inferred_state
        doc["region"] = inferred_region
    doc.update({
        "listing_id": listing_id,
        "user_id": user["user_id"],
        "status": "active",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "expires_at": _expiry_iso(),
        "image_url": doc.get("image_url"),
    })
    await db.listings.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/listings/{listing_id}")
async def update_listing(listing_id: str, body: ListingIn, user: dict = Depends(get_current_user)):
    item = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Listing not found")
    if item["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    update = body.model_dump()
    update["updated_at"] = _now_iso()
    await db.listings.update_one({"listing_id": listing_id}, {"$set": update})
    return await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})


@api_router.post("/listings/{listing_id}/deactivate")
async def deactivate_listing(listing_id: str, user: dict = Depends(get_current_user)):
    item = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Listing not found")
    if item["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.listings.update_one(
        {"listing_id": listing_id},
        {"$set": {"status": "inactive", "updated_at": _now_iso()}},
    )
    return {"ok": True, "status": "inactive"}


@api_router.post("/listings/{listing_id}/reactivate")
async def reactivate_listing(listing_id: str, user: dict = Depends(get_current_user)):
    item = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Listing not found")
    if item["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    now = _now_iso()
    await db.listings.update_one(
        {"listing_id": listing_id},
        {"$set": {"status": "active", "created_at": now, "updated_at": now, "expires_at": _expiry_iso()}},
    )
    return {"ok": True, "status": "active", "expires_at": _expiry_iso()}


# ============== NOTIFICATIONS ==============
NOTIFICATION_INTERVAL_SECONDS = int(os.environ.get("NOTIFICATION_INTERVAL_SECONDS", "21600"))  # 6 hours


def notifications_enabled() -> bool:
    if os.environ.get("NOTIFICATIONS_ENABLED", "true").lower() in {"0", "false", "no", "off"}:
        return False
    return all([
        os.environ.get("SMTP_HOST"),
        os.environ.get("SMTP_USERNAME"),
        os.environ.get("SMTP_PASSWORD"),
        os.environ.get("SMTP_FROM_EMAIL"),
    ])


def frontend_url() -> str:
    return os.environ.get("FRONTEND_URL") or "https://soberboard.com"


def listing_url(listing_id: str) -> str:
    return f"{frontend_url().rstrip('/')}/beds/{listing_id}"


def beds_url(filters: Optional[Dict[str, Any]] = None) -> str:
    base = f"{frontend_url().rstrip('/')}/beds"
    if not filters:
        return base
    from urllib.parse import urlencode
    params = {}
    for key, value in filters.items():
        if value is True:
            params[key] = "true"
        elif value:
            params[key] = str(value)
    return f"{base}?{urlencode(params)}" if params else base


def send_email_sync(to_email: str, subject: str, body: str):
    port = int(os.environ.get("SMTP_PORT", "587"))
    use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() not in {"0", "false", "no", "off"}
    from_email = os.environ["SMTP_FROM_EMAIL"]
    from_name = os.environ.get("SMTP_FROM_NAME", "SoberBoard")

    message = EmailMessage()
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(os.environ["SMTP_HOST"], port, timeout=20) as smtp:
        if use_tls:
            smtp.starttls()
        smtp.login(os.environ["SMTP_USERNAME"], os.environ["SMTP_PASSWORD"])
        smtp.send_message(message)


async def send_email(to_email: str, subject: str, body: str) -> bool:
    if not notifications_enabled():
        return False
    try:
        await asyncio.to_thread(send_email_sync, to_email, subject, body)
        return True
    except Exception as e:
        logging.getLogger("soberboard").warning(f"Email send failed to {to_email}: {e}")
        return False


def listing_price(listing: dict) -> str:
    if listing.get("price_weekly"):
        return f"${int(listing['price_weekly'])}/week"
    if listing.get("price_monthly"):
        return f"${int(listing['price_monthly'])}/month"
    return "Ask manager"


def describe_saved_filters_for_email(filters: Dict[str, Any]) -> str:
    parts = []
    if filters.get("region"):
        parts.append(f"{filters['region']}{', ' + filters['state'] if filters.get('state') else ''}")
    elif filters.get("city"):
        parts.append(filters["city"])
    if filters.get("q"):
        parts.append(f"search: {filters['q']}")
    if filters.get("gender"):
        parts.append(filters["gender"])
    if filters.get("max_price"):
        parts.append(f"under ${int(float(filters['max_price']))}/week")
    if filters.get("insurance"):
        parts.append("insurance accepted")
    if filters.get("pets"):
        parts.append("pets allowed")
    return " · ".join(parts) if parts else "your saved search"


async def run_saved_search_alerts() -> int:
    await _expire_stale()
    sent = 0
    now = _now_iso()
    cursor = db.saved_searches.find({"alerts_enabled": True}, {"_id": 0})
    async for saved in cursor:
        user = await db.users.find_one({"user_id": saved["user_id"]}, {"_id": 0, "email": 1, "name": 1})
        if not user or not user.get("email"):
            continue

        filters = saved.get("filters", {})
        since = saved.get("last_checked_at") or saved.get("created_at") or now
        query = build_listing_query(
            city=filters.get("city"),
            state=filters.get("state"),
            region=filters.get("region"),
            gender=filters.get("gender"),
            pets=filters.get("pets"),
            insurance=filters.get("insurance"),
            max_price=filters.get("max_price"),
            q=filters.get("q"),
            created_after=since,
        )
        matches = await db.listings.find(query, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
        update = {"last_checked_at": now, "updated_at": now}
        if matches:
            lines = [
                f"New SoberBoard beds matched: {saved.get('name', 'Saved search')}",
                "",
                f"Search: {describe_saved_filters_for_email(filters)}",
                "",
            ]
            for listing in matches:
                lines.extend([
                    f"- {listing['house_name']} in {listing['city']}, {listing.get('state', '')}",
                    f"  {listing.get('beds_open', 0)} beds open · {listing_price(listing)}",
                    f"  Manager: {listing.get('manager_name', 'House manager')} · {listing.get('manager_phone', 'phone not listed')}",
                    f"  {listing_url(listing['listing_id'])}",
                    "",
                ])
            lines.extend([
                f"View this search: {beds_url(filters)}",
                "",
                "You can turn alerts off from your saved search on SoberBoard.",
            ])
            if await send_email(user["email"], f"SoberBoard: new beds for {saved.get('name', 'your saved search')}", "\n".join(lines)):
                update["last_alerted_at"] = now
                sent += 1
        await db.saved_searches.update_one({"saved_search_id": saved["saved_search_id"]}, {"$set": update})
    return sent


async def run_listing_expiration_reminders() -> int:
    now_dt = datetime.now(timezone.utc)
    sent = 0
    cursor = db.listings.find({"status": "active"}, {"_id": 0})
    async for listing in cursor:
        expires_raw = listing.get("expires_at")
        if not expires_raw:
            continue
        try:
            expires_at = datetime.fromisoformat(expires_raw)
        except ValueError:
            continue
        seconds_left = (expires_at - now_dt).total_seconds()
        if seconds_left <= 0:
            continue

        reminder_key = None
        reminder_label = None
        if seconds_left <= 86400 and not listing.get("reminder_1d_sent_at"):
            reminder_key = "reminder_1d_sent_at"
            reminder_label = "1 day"
        elif seconds_left <= 3 * 86400 and not listing.get("reminder_3d_sent_at"):
            reminder_key = "reminder_3d_sent_at"
            reminder_label = "3 days"
        if not reminder_key:
            continue

        owner = await db.users.find_one({"user_id": listing["user_id"]}, {"_id": 0, "email": 1, "name": 1})
        if not owner or not owner.get("email"):
            continue
        body = "\n".join([
            f"Hi {owner.get('name', 'there')},",
            "",
            f"Your SoberBoard listing for {listing['house_name']} expires in about {reminder_label}.",
            "",
            "If the bed is still open, reactivate it from your dashboard so it stays visible.",
            "If it is filled, you can leave it inactive and reuse the listing later.",
            "",
            f"Listing: {listing_url(listing['listing_id'])}",
            f"Dashboard: {frontend_url().rstrip('/')}/dashboard",
        ])
        if await send_email(owner["email"], f"SoberBoard reminder: {listing['house_name']} expires soon", body):
            await db.listings.update_one(
                {"listing_id": listing["listing_id"]},
                {"$set": {reminder_key: _now_iso()}},
            )
            sent += 1
    return sent


async def run_notifications_once():
    if not notifications_enabled():
        return {"enabled": False, "saved_search_alerts": 0, "expiration_reminders": 0}
    saved_sent = await run_saved_search_alerts()
    reminder_sent = await run_listing_expiration_reminders()
    return {"enabled": True, "saved_search_alerts": saved_sent, "expiration_reminders": reminder_sent}


async def notification_loop():
    while True:
        try:
            result = await run_notifications_once()
            if result["enabled"]:
                logging.getLogger("soberboard").info(f"Notification run complete: {result}")
        except Exception as e:
            logging.getLogger("soberboard").warning(f"Notification loop failed: {e}")
        await asyncio.sleep(NOTIFICATION_INTERVAL_SECONDS)


# ============== JOBS ==============
@api_router.get("/jobs")
async def list_jobs(city: Optional[str] = None, q: Optional[str] = None):
    query = {}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
        ]
    return await db.jobs.find(query, {"_id": 0}).sort("posted_at", -1).to_list(200)


# ============== SERVICES ==============
@api_router.get("/services")
async def list_services(category: Optional[str] = None):
    query = {}
    if category and category != "all":
        query["category"] = category
    return await db.services.find(query, {"_id": 0}).to_list(200)


# ============== ADS ==============
@api_router.get("/ads")
async def list_ads(slot: Optional[str] = None, limit: int = 6):
    query = {}
    if slot:
        query["slot"] = slot
    return await db.ads.find(query, {"_id": 0}).limit(limit).to_list(limit)


# ============== DAILY REFLECTION ==============
REFLECTIONS = [
    {"title": "Just for today", "body": "I will try to live through this day only, not tackle my whole life problem at once.", "source": "Just For Today"},
    {"title": "One day at a time", "body": "Yesterday is history. Tomorrow is a mystery. Today is a gift.", "source": "Recovery wisdom"},
    {"title": "Progress, not perfection", "body": "We claim spiritual progress rather than spiritual perfection.", "source": "Big Book"},
    {"title": "Easy does it", "body": "Slow down. Recovery happens one breath at a time.", "source": "AA slogan"},
    {"title": "First things first", "body": "Today, sobriety comes before everything else.", "source": "AA slogan"},
    {"title": "Live and let live", "body": "I am responsible for my recovery, not yours. And that is enough.", "source": "AA slogan"},
    {"title": "This too shall pass", "body": "No feeling is final. Sit with it. Breathe through it. Keep going.", "source": "Recovery wisdom"},
]


@api_router.get("/reflection/today")
async def reflection_today():
    idx = datetime.now(timezone.utc).timetuple().tm_yday % len(REFLECTIONS)
    r = REFLECTIONS[idx]
    return {**r, "date": datetime.now(timezone.utc).date().isoformat()}


@api_router.get("/stats")
async def stats():
    await _expire_stale()
    active = await db.listings.count_documents({"status": "active"})
    cities = await db.listings.distinct("city", {"status": "active"})
    states = await db.listings.distinct("state", {"status": "active"})
    regions = await db.listings.distinct("region", {"status": "active"})
    beds = await db.listings.aggregate([
        {"$match": {"status": "active"}},
        {"$group": {"_id": None, "total": {"$sum": "$beds_open"}}},
    ]).to_list(1)
    total_beds = beds[0]["total"] if beds else 0
    return {
        "active_listings": active,
        "total_open_beds": total_beds,
        "cities_covered": len(cities),
        "regions_covered": len(regions),
        "states_covered": len(states),
    }


# ============== ROOT ==============
@api_router.get("/")
async def root():
    return {"app": "SoberBoard", "ok": True}


# ============== UPLOADS ==============
@api_router.post("/uploads/image")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """Operator-uploaded listing photos. Returns the Cloudinary CDN URL directly."""
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, GIF, WEBP, or HEIC images are supported")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 8 MB)")
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    content_type = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    public_id = f"{user['user_id']}/{uuid.uuid4().hex}"
    cdn_url = upload_to_cloudinary(data, public_id, content_type)
    await db.uploaded_files.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "cdn_url": cdn_url,
        "public_id": public_id,
        "original_filename": file.filename,
        "content_type": content_type,
        "size": len(data),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": cdn_url}


# ============== STARTUP / SEED ==============
# Region inference for backfill — keeps existing OC seed data intact while
# letting us expand to LA, San Diego, Inland Empire, and other states.
ZIP_TO_REGION = {
    # Orange County
    "92840": ("CA", "Orange County"), "92626": ("CA", "Orange County"),
    "92647": ("CA", "Orange County"), "92704": ("CA", "Orange County"),
    "92804": ("CA", "Orange County"), "92708": ("CA", "Orange County"),
    "92683": ("CA", "Orange County"), "92660": ("CA", "Orange County"),
    "92867": ("CA", "Orange County"), "92614": ("CA", "Orange County"),
    "92780": ("CA", "Orange County"), "92691": ("CA", "Orange County"),
    "92630": ("CA", "Orange County"), "92831": ("CA", "Orange County"),
    # Los Angeles County
    "90803": ("CA", "Los Angeles County"), "90250": ("CA", "Los Angeles County"),
    "90802": ("CA", "Los Angeles County"), "91101": ("CA", "Los Angeles County"),
    "90404": ("CA", "Los Angeles County"), "90291": ("CA", "Los Angeles County"),
    # San Diego
    "92101": ("CA", "San Diego"), "92103": ("CA", "San Diego"),
    "92054": ("CA", "San Diego"), "92021": ("CA", "San Diego"),
    # Inland Empire
    "92501": ("CA", "Inland Empire"), "92410": ("CA", "Inland Empire"),
    "92335": ("CA", "Inland Empire"), "92223": ("CA", "Inland Empire"),
    # Arizona (proves we're cross-state)
    "85016": ("AZ", "Phoenix Metro"), "85281": ("AZ", "Phoenix Metro"),
    "85701": ("AZ", "Tucson"),
}

CITY_TO_REGION = {
    # OC
    "garden grove": ("CA", "Orange County"), "costa mesa": ("CA", "Orange County"),
    "huntington beach": ("CA", "Orange County"), "santa ana": ("CA", "Orange County"),
    "anaheim": ("CA", "Orange County"), "fountain valley": ("CA", "Orange County"),
    "westminster": ("CA", "Orange County"), "newport beach": ("CA", "Orange County"),
    "orange": ("CA", "Orange County"), "irvine": ("CA", "Orange County"),
    "tustin": ("CA", "Orange County"), "mission viejo": ("CA", "Orange County"),
    "lake forest": ("CA", "Orange County"), "fullerton": ("CA", "Orange County"),
    # LA
    "long beach": ("CA", "Los Angeles County"), "pasadena": ("CA", "Los Angeles County"),
    "los angeles": ("CA", "Los Angeles County"), "santa monica": ("CA", "Los Angeles County"),
    "venice": ("CA", "Los Angeles County"), "hawthorne": ("CA", "Los Angeles County"),
    # SD
    "san diego": ("CA", "San Diego"), "oceanside": ("CA", "San Diego"),
    "el cajon": ("CA", "San Diego"),
    # IE
    "riverside": ("CA", "Inland Empire"), "san bernardino": ("CA", "Inland Empire"),
    "fontana": ("CA", "Inland Empire"), "beaumont": ("CA", "Inland Empire"),
    # AZ
    "phoenix": ("AZ", "Phoenix Metro"), "tempe": ("AZ", "Phoenix Metro"),
    "tucson": ("AZ", "Tucson"),
}


def infer_region(city: str, zip_code: str) -> tuple:
    if zip_code in ZIP_TO_REGION:
        return ZIP_TO_REGION[zip_code]
    return CITY_TO_REGION.get((city or "").strip().lower(), ("CA", "Other"))


LISTING_FIELD_DEFAULTS = {
    "accepts_insurance": False,
    "insurance_notes": "",
    "drug_testing": "",
    "curfew": "",
    "meeting_requirements": "",
    "smoking_policy": "",
    "house_rules": [],
}


SEED_LISTINGS = [
    {"house_name": "Garden Grove Sober House", "city": "Garden Grove", "zip_code": "92840", "beds_open": 2, "price_weekly": 175, "price_monthly": 700, "people_per_room": 2, "gender": "men", "pets_allowed": False, "pool": True, "parking": "driveway", "amenities": ["Pool in backyard", "Plenty of parking", "Cable & WiFi", "Weekly house meetings"], "description": "Quiet 6-bed home in Garden Grove. Walking distance to AA meetings. House manager lives on-site.", "manager_name": "Marcus Reyes", "manager_phone": "(714) 555-0142", "image_url": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900"},
    {"house_name": "Costa Mesa Recovery Residence", "city": "Costa Mesa", "zip_code": "92626", "beds_open": 1, "price_weekly": 200, "price_monthly": 800, "people_per_room": 2, "gender": "men", "pets_allowed": False, "pool": False, "parking": "street", "amenities": ["Cable & WiFi", "Bike storage", "Bus line nearby"], "description": "3-man room available. Drug-tested house, structured environment, 12-step required.", "manager_name": "David Kim", "manager_phone": "(949) 555-0188", "image_url": "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=900"},
    {"house_name": "Huntington Hope House", "city": "Huntington Beach", "zip_code": "92647", "beds_open": 3, "price_weekly": 225, "price_monthly": 900, "people_per_room": 3, "gender": "women", "pets_allowed": True, "pool": True, "parking": "garage", "amenities": ["Pool", "Garage parking", "Pet friendly", "Surf gear storage"], "description": "Beautiful women's house 1 mile from the beach. Cats welcome, no dogs. Sponsor required.", "manager_name": "Janet Cole", "manager_phone": "(714) 555-0203", "image_url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900"},
    {"house_name": "Santa Ana Serenity", "city": "Santa Ana", "zip_code": "92704", "beds_open": 4, "price_weekly": 150, "price_monthly": 600, "people_per_room": 2, "gender": "men", "pets_allowed": False, "pool": False, "parking": "street", "amenities": ["Bus line", "Walk to meetings", "Furnished"], "description": "Affordable men's recovery home. Bilingual house, weekly meetings on-site.", "manager_name": "Carlos Mendez", "manager_phone": "(714) 555-0167", "image_url": "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=900"},
    {"house_name": "Anaheim Anchor House", "city": "Anaheim", "zip_code": "92804", "beds_open": 2, "price_weekly": 185, "price_monthly": 740, "people_per_room": 2, "gender": "any", "pets_allowed": False, "pool": False, "parking": "driveway", "amenities": ["Driveway parking", "Laundry on-site", "Quiet street"], "description": "Co-ed sober living, separate floors by gender. 30-day minimum stay.", "manager_name": "Tasha Bell", "manager_phone": "(714) 555-0119", "image_url": "https://images.unsplash.com/photo-1602343168117-bb8ffe3e2e9f?w=900"},
    {"house_name": "Fountain Valley Fellowship", "city": "Fountain Valley", "zip_code": "92708", "beds_open": 1, "price_weekly": 250, "price_monthly": 1000, "people_per_room": 1, "gender": "men", "pets_allowed": False, "pool": True, "parking": "garage", "amenities": ["Private room", "Pool", "Gym membership included"], "description": "Premium men's house. Private room available. Background screening required.", "manager_name": "Tom Whitaker", "manager_phone": "(714) 555-0299", "image_url": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900"},
    {"house_name": "Westminster Way Home", "city": "Westminster", "zip_code": "92683", "beds_open": 2, "price_weekly": 165, "price_monthly": 660, "people_per_room": 3, "gender": "men", "pets_allowed": False, "pool": False, "parking": "street", "amenities": ["Walking distance to meetings", "Furnished"], "description": "3-man room. House manager 25+ years sober. Strong fellowship.", "manager_name": "Greg Yamamoto", "manager_phone": "(714) 555-0144", "image_url": "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=900"},
    {"house_name": "Newport Coastal Living", "city": "Newport Beach", "zip_code": "92660", "beds_open": 1, "price_weekly": 350, "price_monthly": 1400, "people_per_room": 2, "gender": "women", "pets_allowed": True, "pool": True, "parking": "garage", "amenities": ["Pool", "Beach access", "Pet-friendly", "Yoga room"], "description": "Upscale women's recovery home. Wellness-focused programming.", "manager_name": "Erin Walsh", "manager_phone": "(949) 555-0277", "image_url": "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=900"},
    {"house_name": "Orange Hilltop House", "city": "Orange", "zip_code": "92867", "beds_open": 3, "price_weekly": 175, "price_monthly": 700, "people_per_room": 2, "gender": "men", "pets_allowed": False, "pool": False, "parking": "driveway", "amenities": ["Big backyard", "BBQ", "Driveway parking"], "description": "Large 8-bed house with strong sober fellowship. Sponsor & meetings required.", "manager_name": "Ryan O'Connor", "manager_phone": "(714) 555-0186", "image_url": "https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=900"},
    {"house_name": "Irvine Renewal House", "city": "Irvine", "zip_code": "92614", "beds_open": 2, "price_weekly": 275, "price_monthly": 1100, "people_per_room": 2, "gender": "women", "pets_allowed": False, "pool": False, "parking": "garage", "amenities": ["Garage parking", "Quiet neighborhood", "Strong outpatient links"], "description": "Women's structured recovery home. IOP-friendly schedule. 30-day commitment.", "manager_name": "Michelle Tran", "manager_phone": "(949) 555-0155", "image_url": "https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=900"},
    {"house_name": "Long Beach Lighthouse", "city": "Long Beach", "zip_code": "90803", "beds_open": 2, "price_weekly": 195, "price_monthly": 780, "people_per_room": 2, "gender": "any", "pets_allowed": False, "pool": False, "parking": "street", "amenities": ["Walk to beach", "Bus line", "Furnished"], "description": "Co-ed (separate floors) sober living near the beach. LGBTQ+ welcoming.", "manager_name": "Jordan Pierce", "manager_phone": "(562) 555-0211", "image_url": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900"},
    {"house_name": "Mission Viejo Steady House", "city": "Mission Viejo", "zip_code": "92691", "beds_open": 1, "price_weekly": 220, "price_monthly": 880, "people_per_room": 2, "gender": "men", "pets_allowed": False, "pool": True, "parking": "driveway", "amenities": ["Pool", "Hot tub", "Driveway parking"], "description": "Quiet, suburban men's recovery house with pool & hot tub. Working residents preferred.", "manager_name": "Sam Bradford", "manager_phone": "(949) 555-0233", "image_url": "https://images.unsplash.com/photo-1605114089527-de8e80d4c0b8?w=900"},
    {"house_name": "Tustin New Beginnings", "city": "Tustin", "zip_code": "92780", "beds_open": 2, "price_weekly": 170, "price_monthly": 680, "people_per_room": 3, "gender": "men", "pets_allowed": False, "pool": False, "parking": "street", "amenities": ["Furnished", "Cable & WiFi", "Walking distance to meetings"], "description": "Affordable men's sober living. Clean, structured, drug tested.", "manager_name": "Andre Wilson", "manager_phone": "(714) 555-0122", "image_url": "https://images.unsplash.com/photo-1598228723793-52759bba239c?w=900"},
    {"house_name": "Lake Forest Tranquility", "city": "Lake Forest", "zip_code": "92630", "beds_open": 3, "price_weekly": 200, "price_monthly": 800, "people_per_room": 2, "gender": "women", "pets_allowed": True, "pool": False, "parking": "driveway", "amenities": ["Pet-friendly", "Quiet neighborhood", "Furnished"], "description": "Cozy women's house. Small dogs and cats welcome. Strong sponsor culture.", "manager_name": "Linda Park", "manager_phone": "(949) 555-0188", "image_url": "https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=900"},
    {"house_name": "Fullerton Foundation House", "city": "Fullerton", "zip_code": "92831", "beds_open": 4, "price_weekly": 160, "price_monthly": 640, "people_per_room": 4, "gender": "men", "pets_allowed": False, "pool": False, "parking": "street", "amenities": ["Furnished", "Cable & WiFi", "Bus line"], "description": "Entry-level pricing for men just leaving treatment. 30-day minimum, daily check-ins.", "manager_name": "Pete Saldana", "manager_phone": "(714) 555-0177", "image_url": "https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?w=900"},
    # ---- Los Angeles County ----
    {"house_name": "Long Beach Lighthouse North", "city": "Long Beach", "zip_code": "90802", "beds_open": 3, "price_weekly": 200, "price_monthly": 800, "people_per_room": 2, "gender": "men", "pets_allowed": False, "pool": False, "parking": "street", "amenities": ["Walk to meetings", "Bus line", "Furnished"], "description": "Men's house steps from downtown Long Beach. Strong outpatient links.", "manager_name": "Daryl King", "manager_phone": "(562) 555-0288", "image_url": "https://images.unsplash.com/photo-1542621334-a254cf47733d?w=900"},
    {"house_name": "Pasadena Reset Home", "city": "Pasadena", "zip_code": "91101", "beds_open": 2, "price_weekly": 240, "price_monthly": 960, "people_per_room": 2, "gender": "women", "pets_allowed": True, "pool": False, "parking": "driveway", "amenities": ["Pet-friendly", "Quiet street", "Yoga in living room"], "description": "Women's recovery home in old Pasadena. Strong AA fellowship and IOP partners.", "manager_name": "Anne Daniels", "manager_phone": "(626) 555-0190", "image_url": "https://images.unsplash.com/photo-1601565415267-724db0e98c5d?w=900"},
    {"house_name": "Venice Sands Sober Living", "city": "Venice", "zip_code": "90291", "beds_open": 1, "price_weekly": 325, "price_monthly": 1300, "people_per_room": 2, "gender": "men", "pets_allowed": False, "pool": False, "parking": "street", "amenities": ["Walk to beach", "Bike storage", "Surfboard rack"], "description": "Westside men's house. Wellness-leaning. Close to Venice and Santa Monica meetings.", "manager_name": "Kyle Brennan", "manager_phone": "(310) 555-0344", "image_url": "https://images.unsplash.com/photo-1568092775865-66b5b16ec5c5?w=900"},
    # ---- San Diego ----
    {"house_name": "Hillcrest Hope House", "city": "San Diego", "zip_code": "92103", "beds_open": 2, "price_weekly": 220, "price_monthly": 880, "people_per_room": 2, "gender": "any", "pets_allowed": True, "pool": False, "parking": "street", "amenities": ["LGBTQ+ welcoming", "Walk to meetings", "Pet-friendly"], "description": "Co-ed (separate floors) recovery home in Hillcrest. Strong LGBTQ+ recovery community.", "manager_name": "Robin Aguirre", "manager_phone": "(619) 555-0432", "image_url": "https://images.unsplash.com/photo-1581993192873-bf6d9b6b7f0a?w=900"},
    {"house_name": "Oceanside Anchor", "city": "Oceanside", "zip_code": "92054", "beds_open": 4, "price_weekly": 175, "price_monthly": 700, "people_per_room": 3, "gender": "men", "pets_allowed": False, "pool": False, "parking": "driveway", "amenities": ["Veterans welcome", "Bus line", "Walk to beach"], "description": "Men's house near Camp Pendleton. Veterans and active recovery encouraged.", "manager_name": "Dean Holcomb", "manager_phone": "(760) 555-0228", "image_url": "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=900"},
    # ---- Inland Empire ----
    {"house_name": "Riverside Renewal", "city": "Riverside", "zip_code": "92501", "beds_open": 3, "price_weekly": 145, "price_monthly": 580, "people_per_room": 3, "gender": "men", "pets_allowed": False, "pool": False, "parking": "driveway", "amenities": ["Affordable", "Furnished", "Bus line"], "description": "Affordable men's recovery in downtown Riverside. Bilingual house.", "manager_name": "Hector Rivas", "manager_phone": "(951) 555-0162", "image_url": "https://images.unsplash.com/photo-1598228723793-52759bba239c?w=900"},
    {"house_name": "San Bernardino Bridge House", "city": "San Bernardino", "zip_code": "92410", "beds_open": 2, "price_weekly": 140, "price_monthly": 560, "people_per_room": 4, "gender": "men", "pets_allowed": False, "pool": False, "parking": "street", "amenities": ["Affordable", "Furnished", "Walk to meetings"], "description": "Entry-level men's recovery home. Court-card signing, drug tested.", "manager_name": "Rico Salazar", "manager_phone": "(909) 555-0211", "image_url": "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=900"},
    # ---- Arizona — proves we go beyond California ----
    {"house_name": "Phoenix Sun Recovery", "city": "Phoenix", "zip_code": "85016", "beds_open": 3, "price_weekly": 165, "price_monthly": 660, "people_per_room": 2, "gender": "any", "pets_allowed": False, "pool": True, "parking": "garage", "amenities": ["Pool", "AC", "Garage parking", "Bus line"], "description": "Co-ed Phoenix recovery home (separate floors). 100+ AA meetings within 3 miles.", "manager_name": "Brett Donovan", "manager_phone": "(602) 555-0133", "image_url": "https://images.unsplash.com/photo-1564013434775-f71db0030976?w=900"},
    {"house_name": "Tempe Trailhead House", "city": "Tempe", "zip_code": "85281", "beds_open": 2, "price_weekly": 175, "price_monthly": 700, "people_per_room": 2, "gender": "women", "pets_allowed": True, "pool": True, "parking": "driveway", "amenities": ["Pool", "Pet-friendly", "Light rail nearby", "ASU close"], "description": "Women's recovery near ASU. Great for residents working or in school.", "manager_name": "Maya Singh", "manager_phone": "(480) 555-0177", "image_url": "https://images.unsplash.com/photo-1600585154084-4e5fe7c39198?w=900"},
]

SEED_JOBS = [
    {"title": "Warehouse Associate", "company": "Reset Logistics", "city": "Anaheim", "type": "Full-time", "pay": "$20-$24/hr", "tags": ["No background check disqualifier", "Recovery friendly"], "description": "Pick & pack shifts. We hire from the recovery community and partner with local sober homes.", "contact": "hr@resetlogistics.example", "posted_at": "2026-02-01"},
    {"title": "Line Cook", "company": "Second Chance Kitchen", "city": "Costa Mesa", "type": "Full-time", "pay": "$22/hr + tips", "tags": ["Felony friendly", "On-the-job training"], "description": "Fast-paced kitchen run by people in long-term recovery. We get it.", "contact": "kitchen@secondchance.example", "posted_at": "2026-02-03"},
    {"title": "Construction Apprentice", "company": "Anchor Builders", "city": "Santa Ana", "type": "Full-time", "pay": "$25-$30/hr", "tags": ["Union path", "Drug screen at hire"], "description": "Apprenticeship program. We sponsor people coming out of treatment with strong references.", "contact": "jobs@anchorbuilders.example", "posted_at": "2026-02-04"},
    {"title": "Peer Support Specialist", "company": "Coastal Recovery Center", "city": "Huntington Beach", "type": "Full-time", "pay": "$24-$28/hr", "tags": ["Lived experience required", "Benefits"], "description": "Must have 1+ year continuous sobriety. Help others walk the path.", "contact": "careers@coastalrecovery.example", "posted_at": "2026-02-05"},
    {"title": "Dispatcher", "company": "Greenline Movers", "city": "Garden Grove", "type": "Full-time", "pay": "$23/hr", "tags": ["Recovery friendly", "Flex hours"], "description": "Dispatch & customer calls. Must be reliable. We accommodate court & treatment schedules.", "contact": "dispatch@greenline.example", "posted_at": "2026-02-06"},
    {"title": "Retail Sales Associate", "company": "OC Surf Outfitters", "city": "Newport Beach", "type": "Part-time", "pay": "$18/hr + commission", "tags": ["Flexible", "Recovery friendly"], "description": "Part-time retail. Great for someone working a program with daytime IOP.", "contact": "stores@ocsurf.example", "posted_at": "2026-02-07"},
    {"title": "HVAC Helper", "company": "Reliable Air OC", "city": "Orange", "type": "Full-time", "pay": "$22-$26/hr", "tags": ["Trade school stipend", "Drug-free workplace"], "description": "Learn the trade. We pay for HVAC certification after 90 days clean & on time.", "contact": "hr@reliableair.example", "posted_at": "2026-02-08"},
    {"title": "Detail Tech", "company": "Pacific Auto Detail", "city": "Costa Mesa", "type": "Full-time", "pay": "$20/hr + tips", "tags": ["Felony friendly", "Cash tips daily"], "description": "Auto detailing crew. We hire directly from sober houses every quarter.", "contact": "owner@pacificdetail.example", "posted_at": "2026-02-08"},
    {"title": "Caregiver / Home Health Aide", "company": "Steady Hands Care", "city": "Westminster", "type": "Full-time", "pay": "$21-$24/hr", "tags": ["Background check", "Cert provided"], "description": "Compassionate caregivers wanted. Background must be 5+ years clean of violent or financial felonies.", "contact": "care@steadyhands.example", "posted_at": "2026-02-09"},
    {"title": "Landscaper", "company": "Rooted Lawn Co.", "city": "Anaheim", "type": "Full-time", "pay": "$19-$22/hr", "tags": ["Recovery friendly", "Outdoor work"], "description": "Crew leader and laborer roles. Owner is 11 years sober. Honest pay, honest work.", "contact": "hello@rootedlawn.example", "posted_at": "2026-02-10"},
]

SEED_SERVICES = [
    {"name": "Marshall & Ortiz Defense", "category": "DUI / Criminal Defense", "city": "Santa Ana", "phone": "(714) 555-0410", "url": "#", "description": "DUI, drug possession, sober-living friendly fee plans.", "tags": ["DUI", "Possession", "Free consult"]},
    {"name": "Clean Slate Expungement Clinic", "category": "Expungement", "city": "Garden Grove", "phone": "(714) 555-0421", "url": "#", "description": "Sliding-scale expungement help. 1203.4 PC and felony reduction.", "tags": ["Expungement", "Sliding scale"]},
    {"name": "Pacific Behavioral Health", "category": "Mental Health", "city": "Costa Mesa", "phone": "(949) 555-0432", "url": "#", "description": "Dual-diagnosis psychiatry, Medi-Cal accepted, evening hours.", "tags": ["Psychiatry", "Medi-Cal", "Dual diagnosis"]},
    {"name": "OC Insurance Navigators", "category": "Insurance", "city": "Anaheim", "phone": "(714) 555-0443", "url": "#", "description": "Free help enrolling in Covered California, Medi-Cal, and Medicare.", "tags": ["Free", "Bilingual"]},
    {"name": "Bridge Food Pantry", "category": "Food / Basic Needs", "city": "Santa Ana", "phone": "(714) 555-0454", "url": "#", "description": "No-questions-asked groceries 3x/week. ID not required.", "tags": ["Food", "No ID required"]},
    {"name": "Second Wind Counseling", "category": "Mental Health", "city": "Huntington Beach", "phone": "(714) 555-0465", "url": "#", "description": "LMFTs in long-term recovery. Sliding scale $40-$120.", "tags": ["Therapy", "Sliding scale"]},
    {"name": "Lopez Immigration Law", "category": "Immigration", "city": "Santa Ana", "phone": "(714) 555-0476", "url": "#", "description": "Recovery-friendly immigration counsel. Hablamos español.", "tags": ["Immigration", "Spanish"]},
    {"name": "OC DMV Reinstatement Help", "category": "DMV / License", "city": "Westminster", "phone": "(714) 555-0487", "url": "#", "description": "Help getting your license back after DUI. SR-22 referrals.", "tags": ["DMV", "SR-22"]},
    {"name": "Rooted Workforce Center", "category": "Employment", "city": "Anaheim", "phone": "(714) 555-0498", "url": "#", "description": "Resume + interview prep. Direct placement with felony-friendly employers.", "tags": ["Resume", "Placement"]},
    {"name": "Family Bridge Mediation", "category": "Family Law", "city": "Orange", "phone": "(714) 555-0509", "url": "#", "description": "Custody & family mediation for parents in early recovery.", "tags": ["Family", "Mediation"]},
]

SEED_ADS = [
    {"ad_id": "ad_dui_1", "slot": "sidebar", "category": "Legal", "title": "Charged with a DUI?", "subtitle": "Marshall & Ortiz Defense — first consult free", "cta": "Call (714) 555-0410", "color": "#2B4C5F"},
    {"ad_id": "ad_ins_1", "slot": "sidebar", "category": "Insurance", "title": "Treatment without insurance?", "subtitle": "OC Insurance Navigators — free Medi-Cal enrollment", "cta": "Get free help", "color": "#5E7B62"},
    {"ad_id": "ad_car_1", "slot": "inline", "category": "Auto", "title": "Need a car after rehab?", "subtitle": "Sunset Auto — credit-friendly, recovery-aware", "cta": "Browse inventory", "color": "#C26D53"},
    {"ad_id": "ad_treat_1", "slot": "inline", "category": "Treatment", "title": "Coastal Recovery Center", "subtitle": "Outpatient programs that work with sober living schedules", "cta": "Tour the center", "color": "#2B4C5F"},
    {"ad_id": "ad_food_1", "slot": "sidebar", "category": "Food", "title": "Bridge Food Pantry", "subtitle": "Free groceries 3x/week. No ID required.", "cta": "See hours", "color": "#5E7B62"},
    {"ad_id": "ad_mental_1", "slot": "inline", "category": "Mental Health", "title": "Talk to someone who gets it", "subtitle": "Second Wind Counseling — sliding scale $40-$120", "cta": "Book a session", "color": "#D4A373"},
]


@app.on_event("startup")
async def on_startup():
    # Cloudinary init (best-effort — auth still works without storage)
    try:
        if init_cloudinary():
            logging.getLogger("soberboard").info("Cloudinary image storage initialized")
        else:
            logging.getLogger("soberboard").warning("Cloudinary not configured — image uploads disabled")
    except Exception as e:
        logging.getLogger("soberboard").warning(f"Cloudinary init failed at startup: {e}")

    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.listings.create_index("listing_id", unique=True)
    await db.listings.create_index("user_id")
    await db.listings.create_index("city")
    await db.listings.create_index("zip_code")
    await db.listings.create_index("status")
    await db.listing_reports.create_index("listing_id")
    await db.listing_reports.create_index("status")
    await db.listing_reports.create_index("created_at")
    await db.saved_searches.create_index("user_id")
    await db.saved_searches.create_index("saved_search_id", unique=True)
    await db.saved_searches.create_index("alerts_enabled")
    await db.saved_searches.create_index("last_checked_at")
    await db.listings.create_index("expires_at")
    await db.listings.create_index("reminder_3d_sent_at")
    await db.listings.create_index("reminder_1d_sent_at")
    await db.login_attempts.create_index("identifier")

    # Admin seeding
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@soberboard.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        await db.users.insert_one({
            "user_id": "user_admin0001",
            "email": admin_email,
            "name": "SoberBoard Admin",
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "auth_provider": "password",
            "picture": None,
            "phone": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, admin.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Demo manager
    demo_email = "manager@soberboard.com"
    demo = await db.users.find_one({"email": demo_email})
    if not demo:
        await db.users.insert_one({
            "user_id": "user_demo00manager",
            "email": demo_email,
            "name": "Marcus Reyes",
            "password_hash": hash_password("manager123"),
            "role": "manager",
            "auth_provider": "password",
            "picture": None,
            "phone": "(714) 555-0142",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Seed listings + backfill state/region for any existing rows
    # Demo listings get a long expiry so they never drop off the showcase.
    DEMO_EXPIRY_DAYS = 365
    demo_expiry_iso = (datetime.now(timezone.utc) + timedelta(days=DEMO_EXPIRY_DAYS)).isoformat()
    if await db.listings.count_documents({}) == 0:
        for s in SEED_LISTINGS:
            state, region = infer_region(s["city"], s["zip_code"])
            doc = {
                **s,
                **LISTING_FIELD_DEFAULTS,
                "state": s.get("state", state),
                "region": s.get("region", region),
                "listing_id": f"lst_{uuid.uuid4().hex[:12]}",
                "user_id": "user_demo00manager",
                "status": "active",
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
                "expires_at": demo_expiry_iso,
            }
            await db.listings.insert_one(doc)
    else:
        # Backfill missing state/region on previously-seeded rows
        async for row in db.listings.find({"$or": [{"state": {"$exists": False}}, {"region": {"$exists": False}}]}, {"_id": 0, "listing_id": 1, "city": 1, "zip_code": 1}):
            state, region = infer_region(row.get("city", ""), row.get("zip_code", ""))
            await db.listings.update_one({"listing_id": row["listing_id"]}, {"$set": {"state": state, "region": region}})
        # Seed any new region listings that aren't yet in the DB (matched by house_name)
        existing_names = set(await db.listings.distinct("house_name"))
        for s in SEED_LISTINGS:
            if s["house_name"] in existing_names:
                continue
            state, region = infer_region(s["city"], s["zip_code"])
            await db.listings.insert_one({
                **s,
                **LISTING_FIELD_DEFAULTS,
                "state": s.get("state", state),
                "region": s.get("region", region),
                "listing_id": f"lst_{uuid.uuid4().hex[:12]}",
                "user_id": "user_demo00manager",
                "status": "active",
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
                "expires_at": demo_expiry_iso,
            })

    # ALWAYS keep demo listings active + far from expiring, so the showcase never goes empty.
    # Real listings (other users) still auto-expire after 7 days as designed.
    await db.listings.update_many(
        {"user_id": "user_demo00manager"},
        {"$set": {"status": "active", "expires_at": demo_expiry_iso, "updated_at": _now_iso()}},
    )

    for field, default in LISTING_FIELD_DEFAULTS.items():
        await db.listings.update_many({field: {"$exists": False}}, {"$set": {field: default}})

    # Seed jobs
    if await db.jobs.count_documents({}) == 0:
        for j in SEED_JOBS:
            await db.jobs.insert_one({**j, "job_id": f"job_{uuid.uuid4().hex[:10]}"})

    # Seed services
    if await db.services.count_documents({}) == 0:
        for s in SEED_SERVICES:
            await db.services.insert_one({**s, "service_id": f"svc_{uuid.uuid4().hex[:10]}"})

    # Seed ads
    if await db.ads.count_documents({}) == 0:
        for a in SEED_ADS:
            await db.ads.insert_one(a)

    if not getattr(app.state, "notification_task", None):
        app.state.notification_task = asyncio.create_task(notification_loop())


@app.on_event("shutdown")
async def on_shutdown():
    task = getattr(app.state, "notification_task", None)
    if task:
        task.cancel()
    client.close()


# Mount router & CORS
app.include_router(api_router)

# CORS - allow credentials with explicit frontend origin
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
allowed_origins = list({frontend_url, "http://localhost:3000", "https://soberboard.com", "https://www.soberboard.com"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("soberboard")
