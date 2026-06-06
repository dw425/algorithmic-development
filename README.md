# algorithmic-development

Algorithmic multi-vector forecasting platform — turns historical time series into
calibrated **prediction ranges** with honest accuracy, across any dataset / size / time period.

## What it is
A 1,980-vector forecasting engine + a React/TS app to run, inspect, and compare forecasts.

- **Engine** (`forecast-app/backend/engine_vectors.py`): 11 models × 12 lookbacks × 5 scales ×
  3 points → 3D embed → 3 clusterings (KMeans/DBSCAN/GMM) + consensus → Mahalanobis →
  constellation MST → CQR bands → debias → adaptive conformal (ACI) → drift (Page-Hinkley) →
  PSI sentinel → mixture priors → exogenous (market) → Lyapunov → bootstrap stability →
  ρ/effective-N → THieF reconciliation → signal decomposition.
- **Data layer** (`prep.py`): validate/Benford, impute/Hampel, ADF/KPSS/STL, purge/embargo.
- **Generic runner** (`runner.py`): any source (Yahoo ticker / CSV), any size, any window,
  parallel, resumable, self-plotting.

## Run
```bash
cd forecast-app/backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --port 8000 --reload          # backend
cd ../frontend && npm install && npm run dev -- --port 5173   # frontend → http://127.0.0.1:5173
```

## Generic runner examples
```bash
python runner.py --source ticker --idfile candidates.json --count 1000 \
    --eval-start 2025-01-01 --eval-end 2026-01-01 --engine full --workers 10
python runner.py --source csv --csv-dir ./mydata --eval-start 2020-06-01 --eval-end 2021-06-01
```

## Honest notes
- Mean ~70% range-coverage at the target on liquid stocks; calibrated via CQR + ACI.
- ρ ≈ 0.66 across the model pool → effective models ≈ 1.5 (vector *count* ≠ information; the
  error floor is set by correlation, not by how many vectors).
- Purge/embargo matters: removing calibration leakage dropped 90-day coverage 65%→48% (honest).

See `algo_testing.md` for the full design and `BUILD_PLAN.md` for the roadmap (multi-page app:
stock pipeline · data measurements · agentic scenario planner · telemetry · results w/ overlays
+ constellation clustering diagram).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
