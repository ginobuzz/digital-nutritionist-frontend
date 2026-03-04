# Sunday Mornings (Digital Nutritionist AI)

Sunday Mornings is a full-stack nutrition coaching agent focused on one core behavior loop:

1. Plan what you want to eat, or log as you go.
2. Log what you actually ate.
3. See the calorie gap against your goal.
4. Adjust the next day/week with AI support.

The repository includes:
- A React + TypeScript frontend (web and iOS via Capacitor)
- A FastAPI backend (`digital-nutritionist-backend/`)
- Local Docker Compose for full-stack development
- CI and GitHub Pages deployment workflows

## Product POV

### Problem this product addresses
Weight-loss tracking works when users consistently self-monitor, but most people stop because manual logging is tedious.

### Product approach
This app turns calorie tracking into a conversational workflow:
- Users set goals (weight, timeline, activity level)
- Users plan meals and log reality in one unified `Log` experience
- AI helps log meals (text, optional image) and supports planning via chat
- The app computes deficits and progress so users can course-correct quickly

### Current implemented user flow
- Account creation and sign-in
- Goal/profile setup (daily budget derived from Mifflin-St Jeor + activity multipliers)
- Daily dashboard and weekly target context
- Unified planning/logging view (`/log`)
- AI coach chat (`/chat`) with optional meal photo input
- Profile editing + weight check-ins
- Password reset flow
- iOS widget bridge for daily calorie progress + quick log deep links

## Key Features

- Authentication with JWT bearer tokens (`/auth/signup`, `/auth/login`)
- Meal logs, planned meals, activity logs, and weight logs (CRUD)
- Chat-based assistant backed by OpenAI (`gpt-5.1` by default)
- Chat tool calls can create meal logs and planned meals, and look up meal history
- Voice-to-text input in supported browsers (Chrome/Edge best support)
- Optional image attachment for meal/photo-aware chat logging
- Weekly calorie target adjustments and daily target locking logic
- Local chat history persistence per user in browser storage
- Responsive navigation optimized for mobile and desktop

## Architecture

### High-level
- Frontend: React app calls REST endpoints on FastAPI backend
- Backend: FastAPI + SQLModel + OpenAI integration
- Database: SQLite for local quick start, Postgres (Neon) for hosted persistence
- Hosting: frontend via GitHub Pages, backend via Render, DB via Neon

### Runtime flow (production)
1. Frontend (GitHub Pages) sends authenticated requests to Render API.
2. Render API verifies JWT, handles business logic, persists to Neon Postgres.
3. Chat endpoint calls OpenAI and may write structured logs back to DB.
4. Frontend renders updated dashboard/log/chat state.

## Tech Stack

### Frontend
- React 19 + TypeScript
- CRA + CRACO
- MUI v7
- React Router v7
- date-fns
- Recharts
- Capacitor (iOS target)

### Backend
- FastAPI
- SQLModel / SQLAlchemy
- Pydantic v2
- `python-jose` (JWT)
- `bcrypt` (password hashing)
- OpenAI Python SDK
- Uvicorn

## Repository Structure

```text
.
├── src/                               # Frontend application
│   ├── components/                    # UI screens (Dashboard, Log, Chat, Profile, Auth)
│   ├── services/                      # API/auth/config/haptics/widget bridge
│   ├── utils/                         # Calculations, planning logic, error helpers
│   └── hooks/                         # Browser speech-to-text hook
├── digital-nutritionist-backend/      # FastAPI backend
│   ├── app/
│   │   ├── routers/                   # auth/users/chat/meal/planned/activity/weight endpoints
│   │   ├── services/                  # OpenAI chat orchestration
│   │   ├── models.py                  # SQLModel schema
│   │   └── config.py                  # env parsing + hosted safety validation
│   └── tests/                         # Backend unit tests
├── ios/                               # Capacitor iOS project + widget extension
├── scripts/                           # Build/test/smoke/capacitor helper scripts
├── docker-compose.dev.yml             # Full local stack (frontend + backend + postgres)
└── .github/workflows/                 # CI + GitHub Pages deploy
```

## Local Development

### Prerequisites
- Node.js 18+ (Node 20 recommended)
- npm
- Python 3.11+
- (Optional) Docker Desktop for one-command local stack
- (Optional) Xcode for iOS build

### Option A: Full stack via Docker Compose

```bash
docker compose -f docker-compose.dev.yml up --build
```

Endpoints:
- Frontend: `http://localhost:3000`
- Backend API docs: `http://localhost:8000/docs`
- Postgres: `localhost:5432`

Notes:
- Backend container reads `OPENAI_API_KEY` from your shell env if set.
- Compose uses a local dev Postgres DB and wires frontend to `http://backend:8000` internally.

### Option B: Run frontend + backend manually

1. Frontend dependencies:
```bash
npm ci
```

2. Backend setup:
```bash
cd digital-nutritionist-backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
```

3. Edit `digital-nutritionist-backend/.env` with your local values.

4. Start backend:
```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

5. In repo root, start frontend:
```bash
npm start
```

## Environment Variables (Safe Reference)

Only variable names and non-sensitive guidance are listed below.

### Frontend (`.env.production`, `.env.production.local`, shell env)

| Variable | Required | Purpose |
|---|---|---|
| `REACT_APP_API_BASE_URL` | Yes (for deployed frontend) | Base URL for backend API (build-time in CRA). |
| `REACT_APP_BUILD_VERSION` | No | Build metadata shown in About screen. |
| `REACT_APP_BUILD_NUMBER` | No | Build metadata. |
| `REACT_APP_BUILD_DATETIME` | No | Build metadata. |
| `REACT_APP_BUILD_COMMIT` | No | Build metadata. |
| `CAPACITOR_USE_BUNDLED_WEB` | No (iOS scripts) | `true` uses bundled web assets, otherwise hosted web mode. |
| `CAPACITOR_SERVER_URL` | No (iOS scripts) | Override hosted web URL for Capacitor runtime. |

Smoke-test-only vars:
- `DN_SMOKE_API_BASE_URL`
- `DN_SMOKE_REQUIRE_CHAT`
- `DN_SMOKE_KEEP_DATA`
- `DN_SMOKE_TIMEOUT_MS`
- `DN_SMOKE_CHAT_TIMEOUT_MS`

### Backend (`digital-nutritionist-backend/.env`)

Start from `digital-nutritionist-backend/.env.example`.

| Variable | Required (Hosted) | Purpose |
|---|---|---|
| `APP_ENV` | Yes | `beta`/`staging`/`production` triggers hosted safety checks. |
| `DATABASE_URL` | Yes | Postgres connection string (Neon in hosted env). |
| `OPENAI_API_KEY` | Yes (if chat enabled) | OpenAI credentials for coach/chat. |
| `OPENAI_MODEL` | Recommended | Defaults to `gpt-5.1`. |
| `OPENAI_MAX_OUTPUT_TOKENS` | No | Output token budget for model calls. |
| `OPENAI_MAX_OUTPUT_TOKENS_RETRY` | No | Retry token budget after token-limit errors. |
| `ALLOWED_ORIGINS` | Yes | Comma-separated CORS allowlist. |
| `JWT_SECRET_KEY` | Yes | JWT signing key; use strong random value (>=32 chars). |
| `JWT_EXP_MINUTES` | No | JWT expiration (minutes). |
| `FRONTEND_BASE_URL` | Recommended | Used for password reset links. |
| `PASSWORD_RESET_SECRET_KEY` | Yes | Secret for password-reset token signing. |
| `PASSWORD_RESET_EXP_MINUTES` | No | Password reset token expiry. |

## Hosting and Deployment

### Current hosting model
- Frontend: GitHub Pages (see `homepage` in `package.json`)
- Backend API: Render web service
- Database: Neon Postgres
- iOS app: Capacitor wrapper can run in hosted-web mode (default) or bundled mode

### Backend deployment (Render)

Recommended Render settings for this repo:
- Root directory: `digital-nutritionist-backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Set hosted env vars in Render dashboard:
- `APP_ENV=beta` (or `production`)
- `DATABASE_URL` (Neon Postgres, include `?sslmode=require`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional override)
- `JWT_SECRET_KEY`
- `ALLOWED_ORIGINS` (include deployed frontend origin, and `capacitor://localhost` for iOS app)
- `FRONTEND_BASE_URL`
- `PASSWORD_RESET_SECRET_KEY`

Health checks:
- `/health`
- `/health/db`
- `/health/config` (exposes config status booleans only, not raw secrets)

### Database deployment (Neon)

- Use Neon Postgres for persistent hosted data
- Put Neon connection string in Render `DATABASE_URL`
- Include `sslmode=require`
- Prefer pooled endpoint for serverless/short-lived workloads
- Configure Neon backup/PITR per your plan

### Frontend deployment (GitHub Pages)

Automated deploy path:
- Push to `initial-build`
- `.github/workflows/deploy.yml` runs frontend+backend tests first
- If tests pass, GitHub Pages artifact is deployed

Manual fallback:
```bash
npm run deploy
```

## iOS (Capacitor + Widget)

Common commands:

```bash
npm run ios            # hosted-web mode sync + open Xcode
npm run ios:bundled    # bundled-web mode build/sync + open Xcode
npm run ios:refresh    # rebuild bundled assets + sync (without opening)
```

Widget notes:
- Widget extension: `DailyCaloriesWidget`
- Uses app group shared storage for daily calories progress
- Supports deep links into `/log` for quick actions (voice/camera/text)
- In hosted-web mode, widget behavior follows whatever frontend is currently deployed

## API Overview

Public/auth endpoints:
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/email-available`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`
- `GET /health`, `GET /health/db`, `GET /health/config`

Authenticated endpoints (bearer token required):
- `GET/PUT/DELETE /users/{user_id}`
- `GET /users/{user_id}/weight-logs`
- `POST/GET/PUT/DELETE /weight-logs`
- `POST/GET/PUT/DELETE /meal-logs`
- `POST/GET/PUT/DELETE /planned-meals`
- `POST/GET/PUT/DELETE /activity-logs`
- `POST /chat`

## Testing and Quality Gates

### Frontend
```bash
npm run test:ci
npm run test:coverage
```

### Backend
```bash
cd digital-nutritionist-backend
python -m pytest
```

### Full workflow smoke test (requires running API)
```bash
npm run test:smoke
```

Covers:
- signup/login
- profile update
- meal/planned/activity/weight CRUD
- chat meal logging
- logout/re-login

### CI
- `.github/workflows/ci.yml` runs frontend tests + build and backend tests on push/PR/schedule
- Deploy workflow runs tests before publishing GitHub Pages

## Security Notes

- Do not commit secrets, API keys, or raw DB credentials.
- Keep real secrets only in local `.env` (ignored) and hosting provider secret stores (Render/Neon/GitHub settings).
- Hosted backend startup validates critical settings and rejects unsafe defaults.
- Passwords are bcrypt-hashed; tokens are JWT-signed.
- Auth/chat routes include payload size limits and in-memory rate limiting.
- CORS is allowlist-based (`ALLOWED_ORIGINS`); keep it strict in hosted environments.

## Known Limitations

- Password reset email sending is still TODO in production (non-prod logs reset link server-side).
- Rate limiter is in-memory per process (not a distributed global limiter).
- Chat quality depends on OpenAI availability and model behavior.

## Troubleshooting

- 401 or forced sign-out loops:
  - Confirm `JWT_SECRET_KEY` is consistent for active backend instances.
  - Clear browser storage and sign in again.
- CORS failures:
  - Ensure frontend origin is listed in `ALLOWED_ORIGINS`.
- Chat unavailable:
  - Verify `OPENAI_API_KEY` and `OPENAI_MODEL` in backend env.
- Hosted backend using SQLite:
  - Not supported for persistent hosted use; switch `DATABASE_URL` to Neon Postgres.

## Notes for New Contributors

1. Start with `docker-compose.dev.yml` if you want the fastest full-stack boot.
2. Read `digital-nutritionist-backend/.env.example` before configuring env.
3. Use `npm run test:ci` and backend `pytest` before opening PRs.
4. If you touch iOS behavior, verify both hosted and bundled Capacitor modes.

