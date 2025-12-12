# Digital Nutritionist Backend

A FastAPI backend that mirrors the REST interface expected by the digital nutritionist frontend. It supports user management, weight logging, and a GPT-powered chat endpoint.

## Features
- FastAPI with CORS configured for local frontend development.
- SQLModel models for `User` and `WeightLog` with UUID primary keys.
- OpenAI chat completion wrapper targeting `gpt-5.1`.
- SQLite defaults for quick local setup; override `DATABASE_URL` for Neon/Postgres.

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
   DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/digital_nutritionist
   OPENAI_API_KEY=sk-...
   ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   JWT_SECRET_KEY=dev-secret-change-me
   ```
3. Run the API (use the virtualenv so dependencies like `fastapi` are available):
   ```bash
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

## Docker Compose for local full-stack dev
A `docker-compose.dev.yml` file in the repo root starts the frontend, backend, and a Postgres database on a shared network. Set `REACT_APP_API_BASE_URL` to `http://backend:8000` for the frontend service.

## Migrations
Run Alembic or SQLModel migrations as needed. The provided models are ready for initial schema creation via `init_db()` on startup.
