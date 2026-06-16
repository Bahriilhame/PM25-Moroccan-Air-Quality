from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks
from core.cities import CITY_COORDS
from ml.predictor import get_cached_predictions
from ml.loader import get_artefacts

# ── Health ────────────────────────────────────────────────────────────────────
health_router = APIRouter()

@health_router.get("/")
def health():
    preds = get_cached_predictions()
    arts  = get_artefacts()
    return {
        "status": "ok",
        "time":   datetime.now(timezone.utc).isoformat(),
        "model_loaded": arts is not None,
        "predictions_available": preds is not None and not preds.empty,
        "n_predictions": len(preds) if preds is not None else 0,
    }


# ── Cities ────────────────────────────────────────────────────────────────────
cities_router = APIRouter()

@cities_router.get("/")
def list_cities():
    return {
        "count": len(CITY_COORDS),
        "cities": [{"city": c, "lat": lat, "lon": lon} for c, (lat, lon) in CITY_COORDS.items()]
    }


# ── Admin ─────────────────────────────────────────────────────────────────────
admin_router = APIRouter()

@admin_router.post("/collect")
def trigger_collect(bt: BackgroundTasks):
    from scheduler.jobs import job_collect
    bt.add_task(job_collect)
    return {"status": "collect lancé"}

@admin_router.post("/predict")
def trigger_predict(bt: BackgroundTasks):
    from scheduler.jobs import job_predict
    bt.add_task(job_predict)
    return {"status": "predict lancé"}

@admin_router.post("/fine-tune")
def trigger_fine_tune(bt: BackgroundTasks):
    from scheduler.jobs import job_fine_tune
    bt.add_task(job_fine_tune)
    return {"status": "fine-tune lancé"}

@admin_router.post("/full-retrain")
def trigger_full_retrain(bt: BackgroundTasks):
    from scheduler.jobs import job_full_retrain
    bt.add_task(job_full_retrain)
    return {"status": "full retrain lancé"}

@admin_router.post("/push")
def trigger_push(bt: BackgroundTasks):
    from scheduler.jobs import job_push
    bt.add_task(job_push)
    return {"status": "push lancé"}
