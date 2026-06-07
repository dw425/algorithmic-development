#!/bin/bash
# All-gates runner (self-contained). Starts servers, runs every gate, tears down.
# Exits 0 only if backend imports + pytest + tsc + the render gate all pass.
set -e
cd "$(dirname "$0")"

echo "=== backend imports ==="
( cd backend && .venv/bin/python -c "import app; print('backend ok', app.health())" )

if [ -d backend/tests ]; then
  echo "=== backend math gates (pytest) ==="
  ( cd backend && .venv/bin/python -m pytest tests/ -q )
fi

echo "=== frontend typecheck (tsc) ==="
( cd frontend && npx tsc --noEmit )

echo "=== render gate (start servers → assert content → teardown) ==="
( cd backend && .venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000 --log-level error & echo $! > /tmp/agf_be.pid )
( cd frontend && npm run dev -- --port 5173 --host 127.0.0.1 >/tmp/agf_vite.log 2>&1 & echo $! > /tmp/agf_fe.pid )
cleanup() { kill "$(cat /tmp/agf_be.pid 2>/dev/null)" "$(cat /tmp/agf_fe.pid 2>/dev/null)" 2>/dev/null || true; }
trap cleanup EXIT
# wait for both to answer
for i in $(seq 1 30); do
  curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1 && curl -sf http://127.0.0.1:5173/ >/dev/null 2>&1 && break
  sleep 1
done
( cd frontend && node rendertest.mjs http://127.0.0.1:5173/ render.png "Algorithmic Forecasting" )
echo "=== component pages render gate ==="
( cd frontend && node render_components.mjs )

echo ""
echo "ALL GATES PASS ✅"
