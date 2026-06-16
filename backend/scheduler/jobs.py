"""
Scheduler MLOps — tourne en permanence dans HF Space.

Planning (UTC) :
  H:00         → collecte OWM (53 villes)
  H:05         → prédiction Blend Enrichi V2 (53 × 24h)
  H:06         → push history.csv + predictions → HF Dataset
  03:30 /jour  → fine-tune (30 derniers jours)
  Dim 02:00    → full retrain (tout l'historique)
"""

import threading
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from core.config import settings
from core.logger import get_logger
from ml.collector import collect_all, append_to_history
from ml.loader import get_artefacts
from ml.predictor import predict_all_cities, set_cached_predictions
from utils.hf_storage import push_history, push_predictions, push_models

logger = get_logger(__name__)


def job_collect():
    """Collecte PM2.5 + météo OWM pour toutes les villes."""
    logger.info("JOB_COLLECT — start")
    try:
        df_new = collect_all()
        if df_new.empty:
            logger.warning("JOB_COLLECT — aucune donnée")
            return
        append_to_history(df_new)
        logger.info(f"JOB_COLLECT — {len(df_new)} villes ✅")
    except Exception as e:
        logger.error(f"JOB_COLLECT error: {e}")


def job_predict():
    """Génère les prédictions H+1→H+24 pour toutes les villes."""
    logger.info("JOB_PREDICT — start")
    artefacts = get_artefacts()
    if artefacts is None:
        logger.warning("JOB_PREDICT — artefacts non disponibles")
        return

    hist_path = settings.DATA_DIR / "history.csv"
    if not hist_path.exists():
        logger.warning("JOB_PREDICT — historique absent")
        return

    try:
        df_hist = pd.read_csv(hist_path, parse_dates=["datetime"])
        t_now = pd.Timestamp(datetime.now(timezone.utc)).tz_localize(None).replace(
            minute=0, second=0, microsecond=0
        )
        df_pred = predict_all_cities(t_now, df_hist, artefacts)

        if df_pred.empty:
            logger.warning("JOB_PREDICT — aucune prédiction")
            return

        # Mise en cache mémoire
        set_cached_predictions(df_pred)

        # Sauvegarde locale
        pred_path = settings.DATA_DIR / "latest_predictions.parquet"
        df_pred.to_parquet(pred_path, index=False)
        logger.info(f"JOB_PREDICT — {len(df_pred)} prédictions ✅")
    except Exception as e:
        logger.error(f"JOB_PREDICT error: {e}")


def job_push():
    """Push données + prédictions vers HF Dataset."""
    logger.info("JOB_PUSH — start")
    try:
        push_history()
        push_predictions()
        logger.info("JOB_PUSH — ✅")
    except Exception as e:
        logger.error(f"JOB_PUSH error: {e}")


def job_fine_tune():
    """Fine-tune quotidien sur les 30 derniers jours."""
    logger.info("JOB_FINE_TUNE — start")
    hist_path = settings.DATA_DIR / "history.csv"
    if not hist_path.exists():
        logger.warning("JOB_FINE_TUNE — historique absent")
        return
    try:
        from ml.trainer import fine_tune
        df_hist = pd.read_csv(hist_path, parse_dates=["datetime"])
        cutoff  = df_hist["datetime"].max() - pd.Timedelta(days=30)
        df_recent = df_hist[df_hist["datetime"] >= cutoff]

        if len(df_recent) < 2000:
            logger.warning(f"JOB_FINE_TUNE — trop peu de données ({len(df_recent)})")
            return

        result = fine_tune(df_recent)
        push_models()
        logger.info(f"JOB_FINE_TUNE — ✅ blend_w={result['blend_weights']}")
    except Exception as e:
        logger.error(f"JOB_FINE_TUNE error: {e}")


def job_full_retrain():
    """Full retrain hebdomadaire sur tout l'historique."""
    logger.info("JOB_FULL_RETRAIN — start")
    hist_path = settings.DATA_DIR / "history.csv"
    if not hist_path.exists():
        logger.warning("JOB_FULL_RETRAIN — historique absent")
        return
    try:
        from ml.trainer import full_retrain
        df_hist = pd.read_csv(hist_path, parse_dates=["datetime"])
        result  = full_retrain(df_hist)
        push_models()
        logger.info(f"JOB_FULL_RETRAIN — ✅ MAE={result.get('mae_blend')}")
    except Exception as e:
        logger.error(f"JOB_FULL_RETRAIN error: {e}")


def start_scheduler() -> BackgroundScheduler:
    sched = BackgroundScheduler(timezone="UTC")

    sched.add_job(job_collect,      CronTrigger(minute=0),                       id="collect",      replace_existing=True)
    sched.add_job(job_predict,      CronTrigger(minute=5),                       id="predict",      replace_existing=True)
    sched.add_job(job_push,         CronTrigger(minute=6),                       id="push",         replace_existing=True)
    sched.add_job(job_fine_tune,    CronTrigger(hour=3, minute=30),              id="fine_tune",    replace_existing=True)
    sched.add_job(job_full_retrain, CronTrigger(day_of_week="sun", hour=2),      id="full_retrain", replace_existing=True)

    sched.start()
    logger.info(
        "Scheduler démarré | "
        "collect:H:00 predict:H:05 push:H:06 fine_tune:03:30 full_retrain:dim.02:00"
    )
    return sched
