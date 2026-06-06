#!/bin/bash
# All-gates runner. Grows each phase. Exits 0 only if every gate passes.
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
echo ""
echo "ALL GATES PASS ✅"
