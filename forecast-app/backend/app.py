"""Algorithmic Forecasting — backend (Phase 1 scaffold, built fresh from MASTER_BUILD_PLAN).
Endpoints are added one gated phase at a time; nothing here is trusted until its phase passes."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Algorithmic Forecasting")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"status": "ok", "phase": 1}
