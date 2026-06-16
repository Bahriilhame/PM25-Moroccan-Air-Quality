"""
Feature engineering pour l'inférence temps réel — Blend Enrichi V2.
Reproduit exactement la logique des notebooks 2 et 6.
"""

import numpy as np
import pandas as pd

from core.config import settings
from core.logger import get_logger

logger = get_logger(__name__)

WEATHER_COLS = ["temperature", "humidity", "wind_speed", "pressure", "clouds"]


def build_inference_row(
    city: str,
    t_now: pd.Timestamp,
    history_df: pd.DataFrame,
    fc_values: dict,          # {horizon_h: {"temperature": x, "humidity": y, ...}}
    artefacts: dict,
) -> pd.DataFrame:
    """
    Construit le vecteur de features pour l'inférence d'une ville.
    Utilise feat_lgb et feat_cb chargés depuis les artefacts.
    """
    from core.cities import CITY_COORDS

    lags_hours     = settings.LAGS_HOURS
    rolling_windows = settings.ROLLING_WINDOWS
    le             = artefacts["label_encoder"]
    weather_horizons = artefacts.get("weather_horizons", settings.WEATHER_HORIZONS)

    # Historique de la ville
    city_hist = (
        history_df[
            (history_df["city"] == city) &
            (history_df["datetime"] <= t_now)
        ]
        .sort_values("datetime")
        .tail(400)
    )

    if len(city_hist) < 2:
        raise ValueError(f"Historique insuffisant pour {city}: {len(city_hist)} lignes")

    last = city_hist.iloc[-1]
    pm25_series = city_hist.set_index("datetime")["pm2_5"]
    pm25_vals   = pm25_series.values.astype(float)

    row = {}

    # ── Identité ────────────────────────────────────────────────────────────
    row["city"] = city
    try:
        row["city_enc"] = int(le.transform([city])[0])
    except Exception:
        row["city_enc"] = 0

    lat, lon = CITY_COORDS.get(city, (0.0, 0.0))
    row["lat"] = lat
    row["lon"] = lon

    # ── Temporel ────────────────────────────────────────────────────────────
    row["hour"]       = t_now.hour
    row["dayofweek"]  = t_now.dayofweek
    row["month"]      = t_now.month
    row["day"]        = t_now.day
    row["weekofyear"] = int(t_now.isocalendar()[1])
    row["hour_sin"]   = float(np.sin(2 * np.pi * t_now.hour / 24))
    row["hour_cos"]   = float(np.cos(2 * np.pi * t_now.hour / 24))
    row["dow_sin"]    = float(np.sin(2 * np.pi * t_now.dayofweek / 7))
    row["dow_cos"]    = float(np.cos(2 * np.pi * t_now.dayofweek / 7))
    row["month_sin"]  = float(np.sin(2 * np.pi * t_now.month / 12))
    row["month_cos"]  = float(np.cos(2 * np.pi * t_now.month / 12))

    # ── Lags PM2.5 ─────────────────────────────────────────────────────────
    for lag in lags_hours:
        lag_dt = t_now - pd.Timedelta(hours=lag)
        val = pm25_series.get(lag_dt, np.nan)
        row[f"pm25_lag_{lag}h"] = float(val) if not pd.isna(val) else np.nan

    # ── Rolling stats ────────────────────────────────────────────────────────
    for w in rolling_windows:
        sl = pm25_vals[-w:] if len(pm25_vals) >= w else pm25_vals
        row[f"roll_mean_{w}h"] = float(np.nanmean(sl))
        row[f"roll_std_{w}h"]  = float(np.nanstd(sl))
        row[f"roll_min_{w}h"]  = float(np.nanmin(sl))
        row[f"roll_max_{w}h"]  = float(np.nanmax(sl))

    # ── Changes PM2.5 ───────────────────────────────────────────────────────
    row["pm25_change_1h"]  = float(pm25_vals[-1] - pm25_vals[-2]) if len(pm25_vals) >= 2 else np.nan
    row["pm25_change_3h"]  = float(pm25_vals[-1] - row.get("pm25_lag_3h",  pm25_vals[-1]))
    row["pm25_change_6h"]  = float(pm25_vals[-1] - row.get("pm25_lag_6h",  pm25_vals[-1]))
    row["pm25_change_24h"] = float(pm25_vals[-1] - row.get("pm25_lag_24h", pm25_vals[-1]))

    # ── EWM ─────────────────────────────────────────────────────────────────
    s = pd.Series(pm25_vals)
    row["pm25_ewm_6h"]  = float(s.ewm(span=6).mean().iloc[-1])
    row["pm25_ewm_24h"] = float(s.ewm(span=24).mean().iloc[-1])

    # ── Météo actuelle ───────────────────────────────────────────────────────
    for col in WEATHER_COLS:
        row[col] = float(last.get(col, np.nan)) if col in last.index else np.nan

    row["temp_change_1h"] = float(
        city_hist["temperature"].diff().iloc[-1]
    ) if "temperature" in city_hist.columns else np.nan
    row["humidity_change_1h"] = float(
        city_hist["humidity"].diff().iloc[-1]
    ) if "humidity" in city_hist.columns else np.nan

    # ── Interactions météo ───────────────────────────────────────────────────
    temp = row.get("temperature", np.nan)
    hum  = row.get("humidity", np.nan)
    wind = row.get("wind_speed", np.nan)
    row["temp_humidity"] = float(temp * hum)  if not (np.isnan(temp) or np.isnan(hum))  else np.nan
    row["temp_wind"]     = float(temp * wind) if not (np.isnan(temp) or np.isnan(wind)) else np.nan
    row["humidity_wind"] = float(hum  * wind) if not (np.isnan(hum)  or np.isnan(wind)) else np.nan

    # ── Moyennes historiques ─────────────────────────────────────────────────
    row["pm25_city_hour_mean"]  = float(pm25_series[pm25_series.index.hour      == t_now.hour].mean())
    row["pm25_city_dow_mean"]   = float(pm25_series[pm25_series.index.dayofweek == t_now.dayofweek].mean())
    row["pm25_city_month_mean"] = float(pm25_series[pm25_series.index.month     == t_now.month].mean())

    # ── Prévisions météo futures (OWM forecast) ──────────────────────────────
    for h_fc in weather_horizons:
        vals = fc_values.get(h_fc, {})
        for wc in WEATHER_COLS:
            row[f"{wc}_fc_h{h_fc}"] = float(vals.get(wc, np.nan))

    return pd.DataFrame([row])
