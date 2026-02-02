#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Export DATABASE_URL (Neon/Postgres connection string) before running." >&2
  exit 1
fi

# SQLAlchemy URLs may include a driver suffix (e.g., postgresql+psycopg://). libpq tools do not.
db_url="${DATABASE_URL}"
db_url="${db_url/postgresql+psycopg:\/\//postgresql:\/\/}"
db_url="${db_url/postgres+psycopg:\/\//postgresql:\/\/}"
db_url="${db_url/postgres:\/\//postgresql:\/\/}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump not found. Install Postgres client tools (pg_dump/pg_restore) and try again." >&2
  exit 1
fi

backup_dir="${BACKUP_DIR:-backups}"
mkdir -p "${backup_dir}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
outfile="${backup_dir}/digital_nutritionist_${timestamp}.dump"

pg_dump \
  --dbname="${db_url}" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="${outfile}"

echo "Backup written: ${outfile}"
