# SoberBoard — Product Requirements Document

## Mission
Make finding a safe place to live in recovery as simple as searching for an apartment, and make it free for everyone involved.

## Original Problem Statement (verbatim)
> SoberBoard is the MLS for sober living homes. A free directory where house managers post available beds and people in recovery find them, with no listing fees, no signup costs, and no addresses published. Revenue comes from local businesses who want to reach the recovery community through targeted advertising.
>
> Ecosystem: Beds (urgent housing) · Jobs (recovery-friendly employers) · Services (DUI attorneys, expungement, insurance navigators, food assistance, mental health) · Meeting Finder (link-out only).

## User Personas
- **House Manager / Operator** — runs 1+ sober living homes in OC, needs free way to fill open beds quickly. Hates paying for premium placement.
- **Person in Recovery** — leaving treatment, needs to find a bed today. Needs city + price + amenities + a real phone number to call.
- **Sober Living Resident** — already housed, browsing for jobs, services (DUI, expungement, insurance), and community.
- **Local Business** — DUI attorney, insurance broker, dealership, treatment center — wants targeted reach.

## Core Requirements (static)
- 100% free for residents and operators
- Listings show city + zip ONLY — never full address
- Auto-expire after 7 days, soft-archive (active/inactive) — never hard-deleted
- One-click reactivate
- Two auth options: JWT email/password + Emergent Google OAuth
- Revenue model: business ads only

## What's Been Implemented (2026-02-07)
### Backend (FastAPI + MongoDB)
- Auth: register, login, logout, /me, refresh — JWT httpOnly cookies (access + refresh)
- Auth: Emergent Google OAuth callback `/api/auth/google/session` — both paths resolve through unified `get_current_user`
- Brute-force protection (5 fails → 15-min lockout) + admin/demo seeding
- Listings CRUD: list (filterable by city/zip/gender/pets/max_price/q), get, create, update, deactivate (soft), reactivate (resets 7-day expiry), my-listings
- Auto-expire job runs on every listings query
- Jobs read-only API + Services read-only API + Ads read-only API + daily reflection rotator + stats
- Seeded: admin, demo manager (owns all 15 listings), 15 listings across OC, 10 jobs, 10 services, 6 ads

### Frontend (React + Tailwind + shadcn + Fraunces/Manrope)
- Landing: hero with search, stats, how-it-works, featured beds, daily reflection, ecosystem cards, inline ads, operator CTA
- Beds Directory: searchable, filterable grid (city/gender/price/pets) + sidebar ads
- Listing Detail: no address, manager phone, amenities, sidebar ads
- Login + Register: both JWT and Emergent Google
- Auth Callback: handles `#session_id=` from Emergent OAuth
- Dashboard: owned listings, active/inactive sections, deactivate/reactivate buttons, expires-in countdown
- Post Listing: full form with amenity chips, validation
- Jobs Board, Services Directory, About — all rendering seeded content

### Test results (iteration_1.json)
- Backend pytest: 25/25 passed
- Frontend Playwright: all flows verified (login → dashboard, deactivate/reactivate, post listing, logout)
- Success rate: 100% / 100%
- Zero critical issues

## Prioritized Backlog

### P0 — next session
- Photo uploads via object storage (Beds → multiple images)
- Email notifications when listings are about to expire (3 days, 1 day, expired)
- "Recently filled" indicator (last 7 days of inactive listings) for credibility

### P1
- Resident-facing favorites + share-listing link
- Operator analytics: views per listing, calls (tel: tracking)
- Meeting finder: pull AA/NA meetings from public APIs (Meeting Guide format)
- Job posting flow (operators / employers self-serve)
- Service posting flow + verification badge

### P2
- Multi-photo gallery, virtual house tours
- Reviews / verifications by sponsors and house alumni
- Multi-state expansion: state/county routing
- Operator subscription tier for FEATURED placement (still optional)
- Native mobile app

## Test Credentials
- Admin: `admin@soberboard.com` / `admin123`
- Demo manager (owns 15 listings): `manager@soberboard.com` / `manager123`

## Architecture Notes
- `/api` prefix on all backend routes (Kubernetes ingress requirement)
- MongoDB via `MONGO_URL` from `.env`
- Frontend uses `REACT_APP_BACKEND_URL` for all API calls
- Cookies: `SameSite=None; Secure` (preview is HTTPS, cross-site)
- `_id` excluded from all MongoDB responses
- Listings use `user_id` (custom UUID), never `_id`
