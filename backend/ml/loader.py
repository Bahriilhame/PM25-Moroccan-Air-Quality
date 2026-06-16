"""
Chargement des artefacts Blend Enrichi V2 depuis deployment_package/.

Structure attendue dans /app/models/ :
  blend_weights_v2.npy
  label_encoder.pkl
  feat_enriched.pkl
  feat_cb_enriched.pkl
  cat_features.pkl
  weather_horizons.pkl
  city_coords.json
  lgb_enriched/
    lgb_h1.txt, lgb_h2.txt, ..., lgb_h24.txt
  cb_enriched/
    cb_h1.cbm,  cb_h2.cbm,  ..., cb_h24.cbm
"""

import json
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
from catboost import CatBoostRegressor

from core.config import settings
from core.logger import get_logger

logger = get_logger(__name__)

HORIZONS = list(range(1, 25))


def load_artefacts(models_dir: Path = None) -> dict | None:
    """
    Charge tous les artefacts du Blend Enrichi V2.
    Compatible avec la structure deployment_package/ fournie.
    """
    if models_dir is None:
        models_dir = settings.MODELS_DIR

    # Chercher les modèles dans deployment_package/ ou directement dans models/
    candidates = [
        models_dir,
        models_dir / "deployment_package",
    ]
    base = None
    for c in candidates:
        if (c / "blend_weights_v2.npy").exists():
            base = c
            break

    if base is None:
        logger.warning(f"Aucun artefact trouvé dans {models_dir}")
        return None

    logger.info(f"Chargement artefacts depuis {base}")

    try:
        blend_w = np.load(base / "blend_weights_v2.npy")
        le      = joblib.load(base / "label_encoder.pkl")

        # Features lists
        feat_lgb = joblib.load(base / "feat_enriched.pkl")
        feat_cb  = joblib.load(base / "feat_cb_enriched.pkl")
        cat_feat = joblib.load(base / "cat_features.pkl")

        # Weather horizons utilisés à l'entraînement
        weather_horizons = joblib.load(base / "weather_horizons.pkl")

        # City coords (optionnel, on a le fichier core/cities.py aussi)
        city_coords_path = base / "city_coords.json"
        city_coords_extra = {}
        if city_coords_path.exists():
            with open(city_coords_path) as f:
                city_coords_extra = json.load(f)

        # Modèles LGB
        lgb_dir = base / "lgb_enriched"
        cb_dir  = base / "cb_enriched"

        # Nommage flexible : lgb_h1.txt ou lgb_enriched_h1.txt
        def find_lgb(h):
            for name in [f"lgb_h{h}.txt", f"lgb_enriched_h{h}.txt", f"h{h}.txt"]:
                p = lgb_dir / name
                if p.exists():
                    return p
            return None

        def find_cb(h):
            for name in [f"cb_h{h}.cbm", f"cb_enriched_h{h}.cbm", f"h{h}.cbm"]:
                p = cb_dir / name
                if p.exists():
                    return p
            return None

        models_lgb = {}
        models_cb  = {}

        for h in HORIZONS:
            lgb_file = find_lgb(h)
            cb_file  = find_cb(h)

            if lgb_file is None or cb_file is None:
                logger.error(f"Modèle manquant pour H+{h} dans {base}")
                return None

            models_lgb[h] = lgb.Booster(model_file=str(lgb_file))
            cb_model = CatBoostRegressor()
            cb_model.load_model(str(cb_file))
            models_cb[h] = cb_model

        logger.info(
            f"✅ Artefacts chargés: "
            f"LGB={len(models_lgb)} CB={len(models_cb)} "
            f"blend_w={blend_w.tolist()} "
            f"feat_lgb={len(feat_lgb)} feat_cb={len(feat_cb)}"
        )

        return {
            "models_lgb":      models_lgb,
            "models_cb":       models_cb,
            "blend_weights":   blend_w,
            "label_encoder":   le,
            "feat_lgb":        feat_lgb,
            "feat_cb":         feat_cb,
            "cat_features":    cat_feat,
            "weather_horizons": weather_horizons,
            "city_coords_extra": city_coords_extra,
        }

    except Exception as e:
        logger.error(f"Erreur chargement artefacts: {e}")
        return None


# ── Singleton ─────────────────────────────────────────────────────────────────
_artefacts: dict | None = None


def get_artefacts() -> dict | None:
    return _artefacts


def init_artefacts(artefacts: dict):
    global _artefacts
    _artefacts = artefacts
    logger.info("Artefacts initialisés (singleton)")
