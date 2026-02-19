# Digital Nutritionist Backend

A FastAPI backend that mirrors the REST interface expected by the digital nutritionist frontend. It supports user management, weight logging, and a GPT-powered chat endpoint.

## Features
- FastAPI with CORS configured for local frontend development.
- SQLModel models for `User` and `WeightLog` with UUID primary keys.
- OpenAI chat completion wrapper targeting `gpt-5.1`.
- SQLite defaults for quick local setup; use Postgres (e.g. Neon) for beta/prod persistence.

## Getting Started
1. Create a Python virtual environment and install dependencies:
   ```bash
   cd digital-nutritionist-backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -e .
   ```
2. Configure environment variables in `.env`:
   ```bash
   # Local dev (quick start):
   # DATABASE_URL=sqlite:///./app.db
   #
   # Persistent (beta/prod):
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
   APP_ENV=development
   OPENAI_API_KEY=sk-...
   ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   JWT_SECRET_KEY=dev-secret-change-me
   JWT_EXP_MINUTES=43200
   ```
   You can start from `.env.example` and copy it to `.env`.
3. Run the API (use the virtualenv so dependencies like `fastapi` are available):
   ```bash
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

## Deploy (Render)
- Root directory: `digital-nutritionist-backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Env vars:
  - `APP_ENV=beta` (or `staging` / `production`)
  - `OPENAI_API_KEY` (required on hosted envs)
  - `OPENAI_MODEL` (defaults to `gpt-5.1`)
  - `JWT_SECRET_KEY` (required; use a long random value)
  - `JWT_EXP_MINUTES` (e.g. `43200` for 30 days)
  - `ALLOWED_ORIGINS` (include your deployed frontend origin, e.g. `https://glockstock.github.io`)
  - `DATABASE_URL` (Neon/Postgres; include `?sslmode=require`)

This backend will refuse to start on hosted environments if `DATABASE_URL` is SQLite, to avoid losing data on ephemeral disks.

After deploying, you can verify config presence (no secrets) via `GET /health/config`.

## Neon (Persistent DB)
1. Create a Neon project and database (use a dedicated branch/db for beta).
2. Copy the connection string and set it as `DATABASE_URL` in Render:
   - Direct: `postgresql://USER:PASSWORD@ep-xxxxxx.us-east-2.aws.neon.tech/DBNAME?sslmode=require`
   - Pooled (PgBouncer): `postgresql://USER:PASSWORD@ep-xxxxxx-pooler.us-east-2.aws.neon.tech/DBNAME?sslmode=require`
3. Deploy, then verify DB connectivity: `GET /health/db`.

## Backups
- Neon: enable backups / point-in-time restore in Neon for your project/plan.
- Extra safety: take periodic `pg_dump` backups and store them somewhere private (not git).
  ```bash
  export DATABASE_URL='postgresql://...'
  ./scripts/backup_db.sh
  ```

## Docker Compose for local full-stack dev
A `docker-compose.dev.yml` file in the repo root starts the frontend, backend, and a Postgres database on a shared network. Set `REACT_APP_API_BASE_URL` to `http://backend:8000` for the frontend service.

## Migrations
Run Alembic or SQLModel migrations as needed. The provided models are ready for initial schema creation via `init_db()` on startup.
