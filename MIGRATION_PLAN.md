# SoberBoard Migration Plan: EA → Free Stack

## Target Stack ($0/mo)
| Layer | Service | Tier |
|-------|---------|------|
| Frontend | Vercel | Free (Hobby) |
| Backend | Render or Vercel Serverless | Free |
| Database | MongoDB Atlas | Free (512MB) |
| Images | Cloudinary | Free (25GB) |
| Auth | Email/password (bcrypt + JWT) | Built-in |
| DNS | soberboard.com → Vercel | Already owned |

## Current Codebase (from EA export)
- **Backend**: `backend/server.py` (914 lines) — FastAPI + Motor (async MongoDB) + bcrypt/JWT
- **Frontend**: React 19 (CRA/CRACO) + Tailwind 3 + shadcn/ui + Radix + axios
- **Auth**: Email/password JWT + Emergent Google OAuth
- **Images**: Emergent object storage API (`integrations.emergentagent.com/objstore/api/v1/storage`)
- **Seed data**: 24 listings, 10 jobs, 10 services, 6 ads

## Backend Changes Needed (`migration/backend` branch)

### 1. Remove EA dependencies
- Remove `emergentintegrations==0.1.0` from `requirements.txt`
- Remove `.emergent/` directory
- Remove `memory/`, `test_reports/` EA artifacts

### 2. Swap object storage → Cloudinary
Replace these functions in `server.py`:
- `init_storage()` → Cloudinary config init
- `put_object(path, data, content_type)` → `cloudinary.uploader.upload()`
- `get_object(path)` → Cloudinary URL (no proxy needed — use direct CDN URLs)
- `/api/files/{path}` endpoint → redirect to Cloudinary URL or remove (frontend uses direct URLs)
- `/api/uploads/image` → upload to Cloudinary, return CDN URL
- Add `cloudinary` to `requirements.txt`
- Env vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### 3. Clean up auth
- Remove `/api/auth/google/session` Emergent OAuth endpoint
- Remove `AuthCallback` hash-based session handling (or replace with direct Google OAuth later)
- Keep email/password JWT auth as-is (works perfectly)
- Remove Emergent session token logic from `get_current_user()`

### 4. Update CORS
- Replace `recovery-beds.preview.emergentagent.com` with `soberboard.com`, `www.soberboard.com`
- Make `FRONTEND_URL` env var the primary origin

### 5. Environment variables
```
MONGO_URL=mongodb+srv://...@cluster.mongodb.net/soberboard
DB_NAME=soberboard
JWT_SECRET=<generate>
CLOUDINARY_CLOUD_NAME=<from cloudinary>
CLOUDINARY_API_KEY=<from cloudinary>
CLOUDINARY_API_SECRET=<from cloudinary>
FRONTEND_URL=https://soberboard.com
ADMIN_EMAIL=<jeff's email>
ADMIN_PASSWORD=<secure password>
```

### 6. Deployment config
- Add `render.yaml` or `Procfile` for Render: `uvicorn backend.server:app --host 0.0.0.0 --port $PORT`
- Or: convert to Vercel serverless (would need `vercel.json` + adapter)

## Frontend Changes Needed (`migration/frontend` branch — Jeff/Cypher)

### 1. Remove EA-specific code
- Remove `@emergentbase/visual-edits` from `package.json` devDependencies
- Remove `AuthCallback.jsx` (or rewrite for direct Google OAuth)
- Remove hash-based `session_id` check in `App.js` and `AuthContext.jsx`
- Remove `.emergent/emergent.yml`

### 2. Update env
- `REACT_APP_BACKEND_URL` → Render/Vercel backend URL

### 3. Deployment
- Connect GitHub repo to Vercel
- Set build command: `cd frontend && yarn install && yarn build`
- Set output directory: `frontend/build`

## Setup Steps (in order)
1. Create MongoDB Atlas free cluster → get connection string
2. Create Cloudinary free account → get credentials  
3. Create `migration/backend` branch → make backend changes
4. Deploy backend to Render free tier
5. Connect frontend to Vercel → deploy
6. Point soberboard.com DNS to Vercel
7. Test end-to-end
8. Merge branches to main

## Main branch SHA at time of analysis
`98551355c8ff8b4fef8e5d9ba410c234047bdb98`
