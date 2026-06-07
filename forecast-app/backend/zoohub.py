"""Bridge to Project Zoo (modelzoo): makes its full model registry — classical, ensemble,
apex, conformal, explain — available inside the unified platform backend. The Zoo source is
added to sys.path so we import the live package rather than vendoring it."""
import os
import sys

ZOO_SRC = os.environ.get(
    "ZOO_SRC", "/Users/darkstar29/Documents/Github Project/Project Zoo/modelzoo/src")
if os.path.isdir(ZOO_SRC) and ZOO_SRC not in sys.path:
    sys.path.insert(0, ZOO_SRC)

_loaded = False


def available() -> bool:
    return os.path.isdir(ZOO_SRC)


def _ensure():
    """Import + register every model exactly once."""
    global _loaded
    if _loaded:
        return
    from modelzoo import registry
    registry.load_all_models()
    _loaded = True


# Human-readable family + role per registered model module.
_FAMILY = {
    "classical": "Classical", "ensemble": "Ensemble", "apex": "Apex / regime-aware",
    "core": "Core",
}


def list_models() -> list[str]:
    _ensure()
    from modelzoo import registry
    return registry.list_models()


def model_catalog() -> list[dict]:
    """Every Zoo model with its family + one-line description — powers the Model Lab."""
    _ensure()
    from modelzoo import registry
    reg = registry.get_registry()
    out = []
    for name, cls in sorted(reg.items()):
        parts = cls.__module__.split(".")
        fam = parts[-2] if len(parts) >= 2 else "core"
        doc = (cls.__doc__ or "").strip().splitlines()
        out.append({"name": name, "family": _FAMILY.get(fam, fam.title()),
                    "module": cls.__module__, "doc": doc[0][:140] if doc else ""})
    return out


def get_model(name: str, **kwargs):
    _ensure()
    from modelzoo import registry
    return registry.get_model(name, **kwargs)
