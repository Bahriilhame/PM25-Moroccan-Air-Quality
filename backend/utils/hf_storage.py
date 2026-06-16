"""
Synchronisation avec HuggingFace Dataset bahriilhame/pm25-moroccan-data.

Structure du dataset :
  data/history.csv          ← historique PM2.5 collecté (3 ans + temps réel)
  data/latest_predictions.parquet  ← dernières prédictions générées
  models/deployment_package/       ← artefacts Blend Enrichi V2
    ├── blend_weights_v2.npy
    ├── label_encoder.pkl
    ├── feat_enriched.pkl
    ├── feat_cb_enriched.pkl
    ├── cat_features.pkl
    ├── weather_horizons.pkl
    ├── city_coords.json
    ├── lgb_enriched/h1.txt ... h24.txt
    └── cb_enriched/h1.cbm  ... h24.cbm
"""

import os
import tarfile
import time
from pathlib import Path

from huggingface_hub import HfApi, hf_hub_download, snapshot_download

from core.config import settings
from core.logger import get_logger

logger = get_logger(__name__)

DATASET_REPO = settings.HF_DATASET_REPO   # "bahriilhame/pm25-moroccan-data"


def _api() -> HfApi:
    return HfApi(token=settings.HF_TOKEN)


# ── PULL ─────────────────────────────────────────────────────────────────────

def pull_models() -> bool:
    """
    Télécharge les artefacts du Blend Enrichi V2 depuis HF Dataset.
    Décompresse models.tar.gz → /app/models/
    Appelé une seule fois au démarrage du Space.
    """
    models_dir = settings.MODELS_DIR
    models_dir.mkdir(parents=True, exist_ok=True)

    # Vérifier si déjà présents
    blend_file = models_dir / "blend_weights_v2.npy"
    if blend_file.exists():
        logger.info("Modèles déjà présents, skip pull")
        return True

    logger.info("Téléchargement modèles depuis HF Dataset...")
    try:
        local_path = hf_hub_download(
            repo_id=DATASET_REPO,
            repo_type="dataset",
            filename="models.tar.gz",
            token=settings.HF_TOKEN,
            cache_dir=str(settings.CACHE_DIR / "hf"),
        )
        with tarfile.open(local_path, "r:gz") as tar:
            tar.extractall(str(models_dir.parent))
        logger.info(f"Modèles extraits dans {models_dir}")
        return True
    except Exception as e:
        logger.error(f"Erreur pull modèles: {e}")
        return False


def pull_history() -> bool:
    """
    Télécharge l'historique PM2.5 (3 ans) depuis HF Dataset.
    Fichier : data/history.csv
    """
    data_dir = settings.DATA_DIR
    data_dir.mkdir(parents=True, exist_ok=True)
    hist_path = data_dir / "history.csv"

    if hist_path.exists():
        logger.info(f"Historique déjà présent ({hist_path.stat().st_size // 1024} KB)")
        return True

    logger.info("Téléchargement historique depuis HF Dataset...")
    try:
        local_path = hf_hub_download(
            repo_id=DATASET_REPO,
            repo_type="dataset",
            filename="data/history.csv",
            token=settings.HF_TOKEN,
            cache_dir=str(settings.CACHE_DIR / "hf"),
        )
        import shutil
        shutil.copy(local_path, hist_path)
        lines = sum(1 for _ in open(hist_path))
        logger.info(f"Historique téléchargé: {lines:,} lignes")
        return True
    except Exception as e:
        logger.warning(f"Historique non trouvé sur HF ({e}), démarrage sans historique")
        return False


def pull_all() -> None:
    """Pull complet au démarrage: modèles + historique."""
    pull_models()
    pull_history()


# ── PUSH ─────────────────────────────────────────────────────────────────────

def push_history() -> None:
    """
    Pousse history.csv mis à jour vers HF Dataset.
    Appelé toutes les heures après la collecte.
    """
    hist_path = settings.DATA_DIR / "history.csv"
    if not hist_path.exists():
        return
    try:
        api = _api()
        api.upload_file(
            path_or_fileobj=str(hist_path),
            path_in_repo="data/history.csv",
            repo_id=DATASET_REPO,
            repo_type="dataset",
            commit_message=f"hourly data update",
        )
        logger.info("push_history: history.csv → HF Dataset")
    except Exception as e:
        logger.error(f"push_history error: {e}")


def push_predictions() -> None:
    """Pousse les dernières prédictions vers HF Dataset."""
    pred_path = settings.DATA_DIR / "latest_predictions.parquet"
    if not pred_path.exists():
        return
    try:
        api = _api()
        api.upload_file(
            path_or_fileobj=str(pred_path),
            path_in_repo="data/latest_predictions.parquet",
            repo_id=DATASET_REPO,
            repo_type="dataset",
            commit_message="predictions update",
        )
        logger.info("push_predictions: latest_predictions.parquet → HF Dataset")
    except Exception as e:
        logger.error(f"push_predictions error: {e}")


def push_models() -> None:
    """
    Compresse et pousse les modèles après un retrain.
    """
    models_dir = settings.MODELS_DIR
    tar_path = Path("/tmp/models.tar.gz")

    try:
        with tarfile.open(tar_path, "w:gz") as tar:
            tar.add(models_dir, arcname="models")

        api = _api()
        api.upload_file(
            path_or_fileobj=str(tar_path),
            path_in_repo="models.tar.gz",
            repo_id=DATASET_REPO,
            repo_type="dataset",
            commit_message="models update after retrain",
        )
        tar_path.unlink(missing_ok=True)
        logger.info("push_models: models.tar.gz → HF Dataset")
    except Exception as e:
        logger.error(f"push_models error: {e}")
