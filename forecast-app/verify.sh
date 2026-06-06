#!/bin/bash
# Phase 12 — all-gates runner. Exits 0 only if pytest + tsc + headless render all pass.
set -e
cd "$(dirname "$0")"
echo "=== G2/G3 backend math gates (pytest) ==="
backend/.venv/bin/python -m pytest backend/tests/ -q
echo "=== typecheck (tsc) ==="
( cd frontend && npx tsc --noEmit )
echo "=== G4 render gate (headless shell, 0 console errors) ==="
( cd frontend && node rendertest.mjs )
echo ""
echo "ALL GATES PASS ✅"
