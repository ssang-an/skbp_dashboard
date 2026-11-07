#!/bin/sh
# SPCS entrypoint: prepare /app-state/app (code sync + one-time data seed), then run the
# unchanged FastAPI app from there with a single uvicorn worker.
set -eu

python /opt/skbp/image/spcs/bootstrap.py

cd /app-state/app
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 --proxy-headers --forwarded-allow-ips '*'
