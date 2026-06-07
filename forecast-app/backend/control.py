"""The logical control plane. Tracks, per dataset, where it is in the pipeline and the config of
each stage, so the UI can drive ingest → profile → harmonize → sample → model → forecast and know
what's been done. Persisted to JSON so state survives restarts."""
import json
import os

STORE = os.path.join(os.path.dirname(__file__), "datasets", "_pipeline.json")
STAGES = ["ingest", "profile", "harmonize", "sample", "model", "forecast"]


def _all() -> dict:
    if os.path.exists(STORE):
        try:
            return json.load(open(STORE))
        except Exception:  # noqa
            return {}
    return {}


def _save(d: dict):
    json.dump(d, open(STORE, "w"), indent=2)


def _blank() -> dict:
    return {s: {"status": "pending", "config": {}, "summary": {}} for s in STAGES}


def get(sid: str) -> dict:
    d = _all()
    return d.get(sid, _blank())


def set_stage(sid: str, stage: str, status: str = "done", config: dict | None = None,
              summary: dict | None = None) -> dict:
    if stage not in STAGES:
        raise ValueError(f"unknown stage {stage}")
    d = _all()
    p = d.get(sid, _blank())
    p[stage] = {"status": status, "config": config or p[stage].get("config", {}),
                "summary": summary or p[stage].get("summary", {})}
    d[sid] = p
    _save(d)
    return p


def overview() -> list[dict]:
    """Pipeline progress for every dataset — one row per dataset, stage statuses."""
    d = _all()
    out = []
    for sid, p in d.items():
        done = [s for s in STAGES if p.get(s, {}).get("status") == "done"]
        out.append({"id": sid, "stages": {s: p.get(s, {}).get("status", "pending") for s in STAGES},
                    "progress": f"{len(done)}/{len(STAGES)}"})
    return out
