#!/usr/bin/env sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/digital-nutritionist-backend"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "[backend] digital-nutritionist-backend/ not found; skipping"
  exit 0
fi

PYTHON=""
if [ -x "$BACKEND_DIR/.venv/bin/python" ]; then
  PYTHON="$BACKEND_DIR/.venv/bin/python"
elif [ -x "$BACKEND_DIR/.venv/Scripts/python.exe" ]; then
  PYTHON="$BACKEND_DIR/.venv/Scripts/python.exe"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON="$(command -v python)"
fi

if [ -z "$PYTHON" ]; then
  echo "[backend] Python not found; skipping"
  exit 0
fi

if ! "$PYTHON" -c "import pytest" >/dev/null 2>&1; then
  echo "[backend] pytest not installed; skipping"
  echo "[backend] To enable: (cd digital-nutritionist-backend && python -m pip install -e '.[dev]')"
  exit 0
fi

echo "[backend] Running pytest"
cd "$BACKEND_DIR"
"$PYTHON" -m pytest

