from typing import Optional
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from core.cities import CITY_COORDS
from core.config import get_aqi_category, get_aqi_color, settings
from ml.predictor import get_cached_predictions

router = APIRouter()


def _preds() -> pd.DataFrame:
    df = get_cached_predictions()
    if df is None or df.empty:
        raise HTTPException(503, "Prédictions non disponibles — réessaie dans quelques minutes")
    return df


@router.get("/map/h1")
def map_h1():
    """PM2.5 H+1 pour toutes les villes (données carte)."""
    df = _preds()
    df1 = df[df["horizon_h"] == 1].copy()
    rows = []
    for _, r in df1.iterrows():
        city = r["city"]
        lat, lon = CITY_COORDS.get(city, (0, 0))
        rows.append({
            "city":      city,
            "lat":       lat,
            "lon":       lon,
            "pm25_pred": round(float(r["pm25_pred"]), 2),
            "category":  str(r["category"]),
            "color":     str(r["color"]),
            "confidence": float(r["confidence"]),
        })
    return {"count": len(rows), "data": rows}


@router.get("/city/{city_name}")
def city_forecast(city_name: str):
    """Prévisions H+1→H+24 pour une ville."""
    df = _preds()
    city_df = df[df["city"] == city_name].sort_values("horizon_h")
    if city_df.empty:
        raise HTTPException(404, f"Ville '{city_name}' non trouvée")

    # PM2.5 actuel
    current_pm25 = current_cat = current_color = None
    hist_path = settings.DATA_DIR / "history.csv"
    if hist_path.exists():
        try:
            dh = pd.read_csv(hist_path, parse_dates=["datetime"])
            last = dh[dh["city"] == city_name].sort_values("datetime").iloc[-1]
            current_pm25  = round(float(last["pm2_5"]), 2)
            current_cat   = get_aqi_category(current_pm25)
            current_color = get_aqi_color(current_cat)
        except Exception:
            pass

    lat, lon = CITY_COORDS.get(city_name, (0, 0))
    forecasts = []
    for _, r in city_df.iterrows():
        dt = r["datetime"]
        forecasts.append({
            "horizon_h":  int(r["horizon_h"]),
            "datetime":   dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
            "pm25_pred":  round(float(r["pm25_pred"]), 2),
            "category":   str(r["category"]),
            "color":      str(r["color"]),
            "confidence": float(r["confidence"]),
        })

    return {
        "city": city_name, "lat": lat, "lon": lon,
        "current_pm25": current_pm25,
        "current_category": current_cat,
        "current_color": current_color,
        "forecasts": forecasts,
    }


@router.get("/ranking")
def ranking(horizon: int = Query(1, ge=1, le=24)):
    """Classement des villes par PM2.5."""
    df = _preds()
    dh = df[df["horizon_h"] == horizon].sort_values("pm25_pred", ascending=False)
    return {
        "horizon_h": horizon,
        "ranking": dh[["city", "pm25_pred", "category", "color"]].to_dict(orient="records"),
    }


@router.get("/latest")
def latest(horizon: Optional[int] = Query(None, ge=1, le=24)):
    """Toutes les prédictions (optionnel: filtrer par horizon)."""
    df = _preds()
    if horizon:
        df = df[df["horizon_h"] == horizon]
    records = df.to_dict(orient="records")
    for r in records:
        if hasattr(r.get("datetime"), "isoformat"):
            r["datetime"] = r["datetime"].isoformat()
    return {"count": len(records), "data": records}
