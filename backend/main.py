"""
FastAPI — PM2.5 Moroccan Air Quality
Tourne sur HuggingFace Space, port 8000 interne (Nginx proxy → 7860).

Startup :
  1. Pull modèles depuis HF Dataset bahriilhame/pm25-moroccan-data
  2. Pull historique history.csv
  3. Charger les artefacts Blend Enrichi V2
  4. Générer les premières prédictions
  5. Démarrer le scheduler (collecte horaire, retrain, push HF)
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pandas as pd
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes.predictions import router as pred_router
from api.routes.other_routes import (
    health_router, cities_router, admin_router
)
from core.config import settings
from core.logger import get_logger
from ml.loader import load_artefacts, init_artefacts, get_artefacts
from ml.predictor import predict_all_cities, set_cached_predictions
from scheduler.jobs import start_scheduler, job_collect, job_predict
from utils.hf_storage import pull_all

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ──────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("PM2.5 Moroccan Air Quality — HuggingFace Space")
    logger.info("=" * 60)

    settings.setup_dirs()
    loop = asyncio.get_event_loop()

    # 1. Pull modèles + historique depuis HF Dataset
    if settings.HF_TOKEN:
        logger.info("Pull depuis HF Dataset...")
        await loop.run_in_executor(None, pull_all)
    else:
        logger.warning("HF_TOKEN absent — skip pull (mode debug)")

    # 2. Charger les artefacts Blend Enrichi V2
    artefacts = load_artefacts()
    if artefacts:
        init_artefacts(artefacts)
        logger.info("✅ Artefacts Blend Enrichi V2 chargés")
    else:
        logger.error(
            "❌ Artefacts non trouvés dans /app/models/ — "
            "Vérifie que deployment_package/ est uploadé sur HF Dataset"
        )

    # 3. Prédictions initiales
    if get_artefacts() is not None:
        hist_path = settings.DATA_DIR / "history.csv"
        if hist_path.exists():
            logger.info("Génération prédictions initiales...")
            await loop.run_in_executor(None, job_predict)
        else:
            # Première collecte si pas d'historique
            logger.info("Pas d'historique — collecte initiale...")
            await loop.run_in_executor(None, job_collect)
            await loop.run_in_executor(None, job_predict)

    # 4. Scheduler
    sched = start_scheduler()
    app.state.scheduler = sched

    logger.info("🚀 Startup terminé — Space opérationnel")
    yield

    # ── SHUTDOWN ─────────────────────────────────────────────────
    logger.info("Shutdown...")
    if hasattr(app.state, "scheduler"):
        app.state.scheduler.shutdown(wait=False)


app = FastAPI(
    title="PM2.5 Moroccan Air Quality API",
    description="Blend Enrichi V2 — LGB + CatBoost — 53 villes marocaines",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes API
# app.include_router(health_router, prefix="/api/health",      tags=["Health"])
# app.include_router(pred_router,   prefix="/api/predictions", tags=["Predictions"])
# app.include_router(cities_router, prefix="/api/cities",      tags=["Cities"])
# app.include_router(admin_router,  prefix="/api/admin",       tags=["Admin"])


# Routes API
app.include_router(health_router, prefix="/health",      tags=["Health"])
app.include_router(pred_router,   prefix="/predictions", tags=["Predictions"])
app.include_router(cities_router, prefix="/cities",      tags=["Cities"])
app.include_router(admin_router,  prefix="/admin",       tags=["Admin"])

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,   # 8000 interne
        reload=False,
        log_level=settings.LOG_LEVEL.lower(),
    )
