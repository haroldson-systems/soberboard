from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import secrets
import bcrypt
import jwt
import httpx
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional

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


def set_session_cookie(response: Response, session_token: str):
    response.set_cookie("session_token", session_token, httponly=True, secure=True,
                        samesite="none", max_age=7 * 86400, path="/")


def clear_auth_cookies(response: Response):
    for name in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(name, path="/")


async def get_current_user(request: Request) -> dict:
    """Resolve user from either JWT access_token or Emergent session_token cookie/header."""
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

    # 2. Try Emergent session
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            session_token = auth[7:]
    if session_token:
        sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if sess:
            expires_at = sess["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at >= datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user

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
    people_per_room: int = Field(ge=1, le=8, default=2)
    gender: str = "any"  # men, women, couples, any, coed
    pets_allowed: bool = False
    pool: bool = False
    parking: str = "street"  # street, driveway, garage, none
    amenities: List[str] = []
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


# ============== OBJECT STORAGE ==============
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "soberboard"
_storage_key: Optional[str] = None
MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "heic": "image/heic",
}
MAX_IMAGES_PER_LISTING = 6
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB


def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    emergent_key = os.environ.get("EMERGENT_LLM_KEY")
    if not emergent_key:
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": emergent_key}, timeout=15)
        r.raise_for_status()
        _storage_key = r.json().get("storage_key")
        return _storage_key
    except Exception as e:
        logging.getLogger("soberboard").warning(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage unavailable")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=60,
    )
    if r.status_code == 403:
        # Refresh key and retry once
        global _storage_key
        _storage_key = None
        key = init_storage()
        r = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=60,
        )
    r.raise_for_status()
    return r.json()


def get_object(path: str) -> tuple:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Storage unavailable")
    r = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    if r.status_code == 404:
        raise HTTPException(status_code=404, detail="File not found")
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


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
async def logout(response: Response, request: Request):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    clear_auth_cookies(response)
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/google/session")
async def google_session(request: Request, response: Response):
    """Process Emergent OAuth session_id and create app session."""
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()
    email = data["email"].lower().strip()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data["session_token"]

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
            "phone": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    set_session_cookie(response, session_token)
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


@api_router.get("/listings")
async def list_listings(
    city: Optional[str] = None,
    state: Optional[str] = None,
    region: Optional[str] = None,
    zip_code: Optional[str] = None,
    gender: Optional[str] = None,
    pets: Optional[bool] = None,
    max_price: Optional[float] = None,
    q: Optional[str] = None,
):
    await _expire_stale()
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
            {"zip_code": {"$regex": f"^{q}", "$options": "i"}},
        ]})
    query = {"$and": and_clauses} if len(and_clauses) > 1 else and_clauses[0]
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
    await db.listings.update_one(
        {"listing_id": listing_id},
        {"$set": {"status": "active", "updated_at": _now_iso(), "expires_at": _expiry_iso()}},
    )
    return {"ok": True, "status": "active", "expires_at": _expiry_iso()}


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
    """Operator-uploaded listing photos. Returns the storage path; frontend stores
    that on the listing's image_urls array and renders via /api/files/{path}."""
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "jpg"
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, GIF, WEBP, or HEIC images are supported")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 8 MB)")
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    content_type = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    result = put_object(path, data, content_type)
    stored_path = result.get("path", path)
    await db.uploaded_files.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "storage_path": stored_path,
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"path": stored_path, "url": f"/api/files/{stored_path}"}


@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    """Public file proxy. Listings are public so listing photos are public too;
    paths are UUID-based and unguessable."""
    record = await db.uploaded_files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type") or content_type, headers={"Cache-Control": "public, max-age=31536000, immutable"})


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
    # Storage init (best-effort — auth still works without storage)
    try:
        if init_storage():
            logging.getLogger("soberboard").info("Object storage initialized")
        else:
            logging.getLogger("soberboard").warning("Object storage not available — image uploads disabled")
    except Exception as e:
        logging.getLogger("soberboard").warning(f"Storage init failed at startup: {e}")

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


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# Mount router & CORS
app.include_router(api_router)

# CORS - allow credentials with explicit frontend origin
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
preview_url = "https://recovery-beds.preview.emergentagent.com"
allowed_origins = list({frontend_url, preview_url, "http://localhost:3000"})

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
