"""
Inférence Blend Enrichi V2 — PM25PredictorV2.
Utilise les artefacts chargés depuis deployment_package/.
"""

import threading
import time

import numpy as np
import pandas as pd
from catboost import Pool

from core.cities import CITY_COORDS
from core.config import get_aqi_category, get_aqi_color, settings
from core.logger import get_logger
from ml.features import build_inference_row
from ml.collector import fetch_owm_forecast

logger = get_logger(__name__)

HORIZONS = settings.HORIZONS

# Cache prédictions en mémoire
_predictions: pd.DataFrame | None = None
_predictions_lock = threading.Lock()


def get_cached_predictions() -> pd.DataFrame | None:
    with _predictions_lock:
        return _predictions


def set_cached_predictions(df: pd.DataFrame):
    global _predictions
    with _predictions_lock:
        _predictions = df


def predict_city(
    city: str,
    t_now: pd.Timestamp,
    history_df: pd.DataFrame,
    artefacts: dict,
    use_forecast: bool = True,
) -> pd.DataFrame:
    """Prédiction H+1→H+24 pour une ville."""
    lat, lon = CITY_COORDS.get(city, (0, 0))

    # Prévisions OWM
    fc_values = {}
    if use_forecast and settings.OWM_API_KEY:
        try:
            fc_values = fetch_owm_forecast(city, lat, lon)
        except Exception as e:
            logger.warning(f"forecast error {city}: {e}")

    # Vecteur features
    row_df = build_inference_row(city, t_now, history_df, fc_values, artefacts)

    models_lgb  = artefacts["models_lgb"]
    models_cb   = artefacts["models_cb"]
    blend_w     = artefacts["blend_weights"]
    feat_lgb    = artefacts["feat_lgb"]
    feat_cb     = artefacts["feat_cb"]
    cat_features = artefacts["cat_features"]

    # Aligner les colonnes
    X_lgb = row_df.reindex(columns=feat_lgb).fillna(0).values.astype(np.float32)
    X_cb  = row_df.reindex(columns=feat_cb).fillna(0)

    preds = []
    for h in HORIZONS:
        p_lgb = float(models_lgb[h].predict(X_lgb)[0])
        pool  = Pool(X_cb, cat_features=[feat_cb.index(c) for c in cat_features if c in feat_cb])
        p_cb  = float(models_cb[h].predict(pool)[0])

        pm25  = max(0.0, blend_w[0] * p_lgb + blend_w[1] * p_cb)
        cat   = get_aqi_category(pm25)
        conf  = round(max(0.50, 0.93 - (h - 1) * 0.014), 2)

        preds.append({
            "city":       city,
            "datetime":   t_now + pd.Timedelta(hours=h),
            "horizon_h":  h,
            "pm25_pred":  round(pm25, 2),
            "category":   cat,
            "color":      get_aqi_color(cat),
            "confidence": conf,
        })

    return pd.DataFrame(preds)


def predict_all_cities(
    t_now: pd.Timestamp,
    history_df: pd.DataFrame,
    artefacts: dict,
) -> pd.DataFrame:
    """Prédiction pour toutes les 53 villes × 24 horizons."""
    all_preds = []
    errors    = 0

    for city in CITY_COORDS:
        try:
            df_city = predict_city(city, t_now, history_df, artefacts)
            all_preds.append(df_city)
        except Exception as e:
            logger.warning(f"predict error {city}: {e}")
            errors += 1
        time.sleep(0.05)   # Petite pause pour rate limit OWM forecast

    if not all_preds:
        logger.error("predict_all_cities: aucune prédiction générée")
        return pd.DataFrame()

    result = pd.concat(all_preds, ignore_index=True)
    logger.info(
        f"predict_all_cities: {len(result)} prédictions "
        f"({len(CITY_COORDS) - errors}/53 villes) pour {t_now}"
    )
    return result
