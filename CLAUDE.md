# CLAUDE.md — Sunday Mornings (Digital Nutritionist AI)

## Project Overview

Full-stack nutrition coaching app. React frontend (web + iOS via Capacitor) backed by FastAPI. Core loop: plan meals → log actuals → see calorie gap → adjust with AI support.

**App ID:** `com.sundaymornings.app`
**Deployed frontend:** GitHub Pages (`initial-build` branch auto-deploys)
**Backend:** Render + Neon Postgres

---

## Key Commands

```bash
# Dev
npm start                  # Dev server (http://localhost:3000)

# Test
npm run test:ci            # CI mode, no watch
npm run test:coverage      # With coverage
npm run test:staged        # Only staged files (pre-commit hook)
npm run test:smoke         # Full workflow smoke test (requires live API)

# Build
npm run build              # Production build with metadata injection
npm run build:cap          # Capacitor build (PUBLIC_URL=.)
npm run deploy             # Build + GitHub Pages deploy

# iOS / Capacitor
npm run ios                # Hosted-web mode sync + open Xcode
npm run ios:bundled        # Bundled-web mode build/sync + open Xcode
npm run ios:refresh        # Rebuild bundled assets + sync (no Xcode)
npm run cap:sync           # Sync all Capacitor platforms

# Backend (from digital-nutritionist-backend/)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pytest
```

**Full local stack (preferred for full-stack work):**
```bash
docker compose -f docker-compose.dev.yml up --build
# Frontend: http://localhost:3000  Backend: http://localhost:8000/docs
```

---

## Architecture

```
src/
  components/    # UI screens — one file per screen, test file colocated
  services/      # api.ts, auth.ts, config.ts, haptics.ts, widgetBridge.ts
  utils/         # Domain logic: calculations, meal planning, target locking
  hooks/         # useSpeechToText
  types/         # index.ts — all TypeScript interfaces
  data/          # Mock data
  App.tsx        # Root router + auth state + theme provider
  theme.ts       # MUI theme (green primary #22C55E, purple secondary #7C3AED)

digital-nutritionist-backend/
  app/
    routers/     # auth, users, chat, meal-logs, planned-meals, activity-logs, weight-logs
    services/    # OpenAI chat orchestration
    models.py    # SQLModel schema
    config.py    # env parsing + hosted safety validation

ios/             # Capacitor iOS project + DailyCaloriesWidget extension
scripts/         # Build/test/smoke/capacitor helpers
```

---

## State & Auth Patterns

- **Auth:** JWT bearer tokens. Stored in `localStorage` as `dn_access_token`. User profile cached as `dn_user_profile`. Auto sign-out on 401/403.
- **State management:** React local state + `useState`. No Redux. Shared state lifted to `App.tsx`.
- **Persistence:** localStorage for token, user profile, theme preference (`dn_theme_preference`), and chat history per user.
- **Theme:** `'system' | 'light' | 'dark'`. MUI theme with dual stylesheets.

---

## Key Files

| File | Purpose |
|------|---------|
| [src/App.tsx](src/App.tsx) | Root routing, auth state, deep link handler |
| [src/services/api.ts](src/services/api.ts) | All REST API calls (meals, weight, chat, etc.) |
| [src/services/auth.ts](src/services/auth.ts) | Login, signup, password reset, JWT helpers |
| [src/services/config.ts](src/services/config.ts) | API base URL resolution |
| [src/utils/calculations.ts](src/utils/calculations.ts) | Mifflin-St Jeor BMR, calorie targets |
| [src/utils/weeklyTargets.ts](src/utils/weeklyTargets.ts) | Dynamic weekly calorie target calcs |
| [src/utils/dailyTargetLock.ts](src/utils/dailyTargetLock.ts) | Daily target locking logic |
| [src/types/index.ts](src/types/index.ts) | All TypeScript types/interfaces |
| [src/theme.ts](src/theme.ts) | MUI theme configuration |
| [src/components/Dashboard.tsx](src/components/Dashboard.tsx) | Main dashboard (weekly/daily views) |
| [src/components/Log.tsx](src/components/Log.tsx) | Unified meal/activity logging with voice/image |
| [src/components/Chat.tsx](src/components/Chat.tsx) | AI coach chat interface |
| [capacitor.config.ts](capacitor.config.ts) | iOS app config (hosted-web vs bundled-web mode) |

---

## Tech Stack

- **React 19 + TypeScript 4.9** via CRA + CRACO
- **MUI v7** for UI components
- **React Router v7** for navigation
- **Capacitor 8** for iOS (hosted-web default, bundled-web optional)
- **date-fns 4**, **Recharts 3**, **markdown-to-jsx**
- **FastAPI + SQLModel + OpenAI Python SDK** (backend)
- **Husky + lint-staged** (pre-commit: runs related tests)

---

## iOS / Capacitor Notes

- Default mode: **hosted-web** (app loads from GitHub Pages — no reinstall needed for FE changes)
- **Bundled-web** mode: bakes assets into the `.ipa` (use `npm run ios:bundled`)
- **DailyCaloriesWidget**: uses app group shared storage; supports deep links to `/log?mode=voice` etc.
- Add `capacitor://localhost` to backend `ALLOWED_ORIGINS` for iOS requests

---

## Environment Variables

### Frontend (build-time via CRA)
| Variable | Required | Notes |
|---|---|---|
| `REACT_APP_API_BASE_URL` | Yes (deployed) | Backend URL, set in `.env.production` |
| `REACT_APP_BUILD_*` | No | Injected by `scripts/build-with-metadata.js` |

### Backend (`digital-nutritionist-backend/.env`)
Start from `.env.example`. Key vars:
- `DATABASE_URL` — Neon Postgres (include `?sslmode=require`)
- `OPENAI_API_KEY` + `OPENAI_MODEL` (default: `gpt-5.1`)
- `JWT_SECRET_KEY` — strong random, >= 32 chars
- `ALLOWED_ORIGINS` — comma-separated CORS allowlist
- `APP_ENV` — `beta`/`staging`/`production` triggers hosted safety checks

---

## Testing

- **Pre-commit:** Husky runs `npm run test:staged` on changed `.ts/.tsx` files
- **CI:** `.github/workflows/ci.yml` — runs frontend tests + build (8GB mem) and backend `pytest`
- **Deploy:** Triggered on push to `initial-build`; requires CI to pass first
- **Smoke test:** `npm run test:smoke` — full signup→CRUD→chat→logout workflow (requires live API)

---

## Coding Conventions

- One component per file; test files colocated (`Foo.tsx` + `Foo.test.tsx`)
- Services layer handles all API calls — components do not call `fetch` directly
- Utils handle domain logic (calculations, meal planning) — keep them pure
- API responses are normalized in `api.ts` before reaching components
- Mobile-first responsive design; use MUI breakpoints (`xs`, `sm`, `md`, etc.)
- iOS safe area insets handled in `Layout.tsx`
- Do not commit secrets, `.env` files with real values, or raw API keys
