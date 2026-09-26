#!/usr/bin/env bash
# One-command local start: creates venv, installs deps, trains the model if missing, starts the server.
set -e
cd "$(dirname "$0")"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
[ -f .env ] && set -a && . ./.env && set +a
cd backend
[ -f ../data/models/model.joblib ] || ../.venv/bin/python -m app.ml.train
[ "$1" = "--seed" ] && ../.venv/bin/python -m scripts.seed_demo
exec ../.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
