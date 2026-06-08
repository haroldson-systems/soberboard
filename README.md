# SoberBoard

> **The MLS for sober living homes.** Free for residents. Free for operators. Built for the recovery community.

SoberBoard is a free, region-aware directory where house managers post available beds and people in recovery find them — with no listing fees, no signup costs, and no addresses ever published. Revenue comes from local recovery-adjacent businesses (attorneys, insurance, treatment centers, dealerships) who want to reach the recovery community through targeted advertising.

Starting in Orange County, California. Already live across LA County, San Diego, the Inland Empire, and Arizona. Expanding nationwide.

---

## What's in the ecosystem

| Section | Purpose |
|---|---|
| **Beds** | The core — searchable, filterable bed directory across multiple regions |
| **Jobs** | Recovery-aware employers — businesses that understand the journey |
| **Services** | DUI defense, expungement, insurance navigators, food, mental health |
| **Meetings** | A curated hub linking out to AA, NA, CA, Refuge Recovery, SMART, and local intergroups |
| **Community Roots** | A historical tribute to the houses, clubs, and meetings that built recovery in OC |

---

## Tech stack

- **Frontend** — React 19, React Router, Tailwind CSS, shadcn/ui, Fraunces + Manrope typography
- **Backend** — FastAPI (Python 3.11), Motor (async MongoDB driver), Pydantic v2
- **Database** — MongoDB
- **Auth** — Dual-strategy: JWT email/password + Emergent-managed Google OAuth (both resolve through `/api/auth/me`)
- **Storage** — Emergent object storage for listing photos (up to 6 per listing)
- **Hosted** — Emergent platform with Kubernetes-managed routing

---

## Project structure

```
/app
├── backend/
│   ├── server.py              # All FastAPI routes, auth, storage, seed data
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Local env (gitignored)
│
├── frontend/
│   ├── src/
│   │   ├── App.js             # Router + AuthCallback hash handling
│   │   ├── contexts/AuthContext.jsx
│   │   ├── components/
│   │   │   ├── layout/        # Header, Footer
│   │   │   ├── ui/            # shadcn primitives
│   │   │   ├── BedCard.jsx
│   │   │   ├── ImageUploader.jsx
│   │   │   ├── DemoBanner.jsx
│   │   │   └── SponsoredAds.jsx
│   │   ├── pages/
│   │   │   ├── Landing.jsx        # Hero + Community Roots + Featured + Eco cards
│   │   │   ├── BedsDirectory.jsx  # Filterable bed grid + region chips
│   │   │   ├── ListingDetail.jsx  # Listing page + photo gallery + meeting links
│   │   │   ├── Login.jsx, Register.jsx, AuthCallback.jsx
│   │   │   ├── Dashboard.jsx      # Operator dashboard with deactivate/reactivate
│   │   │   ├── PostListing.jsx    # Operator onboarding form
│   │   │   ├── JobsBoard.jsx
│   │   │   ├── Services.jsx
│   │   │   ├── Meetings.jsx       # Meeting finder hub (link-out only)
│   │   │   └── About.jsx
│   │   └── lib/api.js         # Axios instance with withCredentials
│   ├── package.json
│   └── .env                   # REACT_APP_BACKEND_URL (gitignored)
│
└── memory/
    ├── PRD.md                 # Product requirements + delivery log
    └── test_credentials.md    # Test accounts (gitignored in prod)
```

---

## Local development

### Prerequisites
- Python 3.11+
- Node.js 18+ with Yarn
- MongoDB running locally (or a connection string to MongoDB Atlas)

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # then fill in MONGO_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, EMERGENT_LLM_KEY
uvicorn server:app --reload --port 8001
```

The backend serves all routes under `/api`. It seeds 24 demo listings, 10 jobs, 10 services, and 6 sponsored ads on first boot. Demo listings auto-refresh to a 365-day expiry on every boot so the showcase never goes empty; real operator listings auto-expire after **7 days** as designed.

### Email notifications

Saved-search alerts and listing-expiration reminders are dormant until SMTP is configured. Add these backend env vars when the SoberBoard mailbox is ready:

```bash
NOTIFICATIONS_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USERNAME=support@soberboard.com
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=support@soberboard.com
SMTP_FROM_NAME=SoberBoard
FRONTEND_URL=https://soberboard.com
NOTIFICATION_INTERVAL_SECONDS=21600
```

If SMTP settings are missing, the worker starts safely but does not send email.

### Frontend

```bash
cd frontend
yarn install
yarn start
```

`REACT_APP_BACKEND_URL` must point to your backend (`http://localhost:8001` in dev).

---

## Auth model

Two providers, one unified user model.

- **JWT email/password** — `POST /api/auth/register`, `POST /api/auth/login`. Issues httpOnly `access_token` + `refresh_token` cookies.
- **Emergent Google OAuth** — frontend redirects to `https://auth.emergentagent.com/?redirect=<origin>/dashboard`. The callback page exchanges the `session_id` fragment for a `session_token` cookie via `POST /api/auth/google/session`.

Both cookies are resolved by the same `get_current_user` dependency. `GET /api/auth/me` returns the current user regardless of provider. Cookies are `SameSite=None; Secure` since the preview runs over HTTPS.

### Seeded test accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@soberboard.com` | `admin123` |
| Demo Manager (owns all 24 seed listings) | `manager@soberboard.com` | `manager123` |

See `/app/memory/test_credentials.md` for the canonical credentials list.

---

## Listing lifecycle

Listings never hard-delete. Status is one of:

- **`active`** — visible publicly. Auto-expires after 7 days (configurable via `LISTING_DURATION_DAYS`).
- **`inactive`** — operator marked it filled. Soft-archived, can be reactivated in one click.
- **`expired`** — passed the 7-day window. Reactivating resets the clock to a fresh 7 days.

Demo listings owned by `user_demo00manager` are auto-refreshed to a 365-day expiry on every backend boot so the showcase doesn't drop off between sessions.

---

## Image uploads

- Multipart upload via `POST /api/uploads/image` (auth required)
- Stored in Emergent object storage at `soberboard/uploads/<user_id>/<uuid>.<ext>`
- Public read via `GET /api/files/{path}` with 1-year immutable cache headers
- Soft-delete tracked in the `uploaded_files` collection
- Max 6 photos per listing, 8 MB each, JPG/PNG/WEBP/HEIC

---

## Privacy and trust

- **No street addresses are ever published.** Listings show city, state, region, and zip only.
- Manager name and phone are public on each listing — direct connection, no middleman.
- SoberBoard does not screen residents or operators. The platform is a directory, not a placement service.
- All listings carry a **Demo Mode** banner during pre-launch — these are showcase data, not real inventory.

---

## A note on the Community Roots section

The Landing page includes a **Community Roots** section that pays tribute to two specific places in Orange County's recovery history — **Charle Street** and **The Fountain Valley Alano Club**. This is purely a historical and editorial tribute. SoberBoard has no partnership, sponsorship, or affiliation with these houses, clubs, or any 12-step fellowship. The content is informational only.

The **Meetings** page carries the same posture — it links directly to the official meeting finders maintained by AA, NA, CA, Refuge Recovery, and SMART Recovery. SoberBoard publishes no meeting data of its own.

---

## Roadmap

Shipped:
- [x] Bed directory with region/state filtering
- [x] Operator auth (JWT + Google) and dashboard
- [x] Soft-archive + 7-day auto-expire + 1-click reactivate
- [x] Multi-photo uploads via object storage
- [x] Jobs board, Services directory, Meetings hub
- [x] Sponsored ads (display) — Legal, Insurance, Treatment, Auto, Food, Mental Health
- [x] Community Roots historical tribute

Next:
- [ ] Email/SMS expiry reminders (3-day / 1-day before)
- [ ] Region-specific SEO landing pages (`/beds/los-angeles-county`)
- [ ] Resident-facing favorites + shareable listing links
- [ ] Operator analytics (views, calls)
- [ ] Self-serve Job + Service posting flows
- [ ] National rollout state-by-state

---

## License

Proprietary — © SoberBoard. All rights reserved.

Built in California, with love and patience, for the recovery community.
