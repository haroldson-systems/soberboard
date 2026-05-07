# SoberBoard Auth Testing Playbook

## Auth providers
1. **JWT email/password** — cookies `access_token` + `refresh_token`
2. **Emergent Google OAuth** — cookie `session_token`

Both resolve through `GET /api/auth/me` (dual-strategy `get_current_user`).

## Seed accounts
- Admin: `admin@soberboard.com` / `admin123`
- Manager: `manager@soberboard.com` / `manager123` (owns 15 seeded listings)

## Backend smoke tests
```bash
API=$REACT_APP_BACKEND_URL  # or http://localhost:8001 internally

# 1. Register
curl -c c.txt -X POST $API/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"new@x.com","password":"p123","name":"New User"}'

# 2. Login
curl -c c.txt -X POST $API/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@soberboard.com","password":"manager123"}'

# 3. Me (cookie auth)
curl -b c.txt $API/api/auth/me

# 4. My listings (auth required)
curl -b c.txt $API/api/listings/mine

# 5. Public listings
curl $API/api/listings
curl "$API/api/listings?city=Garden+Grove&pets=true"

# 6. Toggle inactive / reactivate
curl -b c.txt -X POST $API/api/listings/<id>/deactivate
curl -b c.txt -X POST $API/api/listings/<id>/reactivate
```

## Frontend flows to verify
- `/login` → JWT login redirects to `/dashboard`
- `/login` → "Continue with Google" hits `https://auth.emergentagent.com/?redirect=<origin>/dashboard`
- After Google OAuth, URL fragment `#session_id=...` is exchanged on `/dashboard` and removed
- `/dashboard` shows manager's listings with status, expires-in, deactivate / reactivate buttons
- Post-listing creates an active listing visible in `/beds` and `/dashboard`
- Logout clears all cookies and `/auth/me` returns 401

## DB checks
```js
use('test_database');
db.users.find({}, {password_hash:0}).pretty()
db.listings.countDocuments({status:"active"})
db.jobs.countDocuments({})
db.services.countDocuments({})
db.ads.countDocuments({})
```
