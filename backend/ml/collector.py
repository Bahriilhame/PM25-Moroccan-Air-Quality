"""
Collecte horaire PM2.5 + météo depuis OpenWeatherMap.
"""

import time
from datetime import datetime, timezone

import pandas as pd
import requests

from core.cities import CITY_COORDS
from core.config import settings
from core.logger import get_logger

logger = get_logger(__name__)

OWM_AIR_URL     = "http://api.openweathermap.org/data/2.5/air_pollution"
OWM_WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"


def fetch_city(city: str, lat: float, lon: float) -> dict | None:
    """Collecte PM2.5 + météo actuelle pour une ville."""
    key = settings.OWM_API_KEY
    try:
        r_air = requests.get(
            OWM_AIR_URL,
            params={"lat": lat, "lon": lon, "appid": key},
            timeout=10,
        )
        r_air.raise_for_status()
        air = r_air.json()

        r_wx = requests.get(
            OWM_WEATHER_URL,
            params={"lat": lat, "lon": lon, "appid": key, "units": "metric"},
            timeout=10,
        )
        r_wx.raise_for_status()
        wx = r_wx.json()

        comp = air["list"][0]["components"]
        return {
            "datetime":    datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0),
            "city":        city,
            "lat":         lat,
            "lon":         lon,
            "pm2_5":       comp.get("pm2_5"),
            "pm10":        comp.get("pm10"),
            "co":          comp.get("co"),
            "no2":         comp.get("no2"),
            "so2":         comp.get("so2"),
            "o3":          comp.get("o3"),
            "nh3":         comp.get("nh3"),
            "temperature": wx["main"].get("temp"),
            "humidity":    wx["main"].get("humidity"),
            "pressure":    wx["main"].get("pressure"),
            "wind_speed":  wx.get("wind", {}).get("speed"),
            "clouds":      wx.get("clouds", {}).get("all"),
        }
    except Exception as e:
        logger.warning(f"fetch_city error {city}: {e}")
        return None


def collect_all() -> pd.DataFrame:
    """Collecte toutes les 53 villes. Retourne un DataFrame."""
    rows = []
    for city, (lat, lon) in CITY_COORDS.items():
        row = fetch_city(city, lat, lon)
        if row:
            rows.append(row)
        time.sleep(0.12)   # Rate limit OWM gratuit

    if not rows:
        logger.error("collect_all: aucune donnée")
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    df["datetime"] = pd.to_datetime(df["datetime"]).dt.tz_localize(None)
    return df.sort_values(["city", "datetime"]).reset_index(drop=True)


def append_to_history(df_new: pd.DataFrame) -> None:
    """Ajoute les nouvelles données à history.csv (dédoublonnage)."""
    hist_path = settings.DATA_DIR / "history.csv"
    if hist_path.exists():
        df_hist = pd.read_csv(hist_path, parse_dates=["datetime"])
        df_combined = (
            pd.concat([df_hist, df_new], ignore_index=True)
            .drop_duplicates(subset=["city", "datetime"], keep="last")
            .sort_values(["city", "datetime"])
        )
    else:
        df_combined = df_new
    df_combined.to_csv(hist_path, index=False)
    logger.info(f"Historique: {len(df_combined):,} lignes")


def fetch_owm_forecast(city: str, lat: float, lon: float) -> dict:
    """
    Prévisions OWM 5j pour une ville.
    Retourne {horizon_h: {"temperature": x, ...}} pour les horizons configurés.
    """
    from core.config import settings as cfg
    key = cfg.OWM_API_KEY
    weather_horizons = cfg.WEATHER_HORIZONS

    cache_dir = settings.CACHE_DIR / "fc"
    cache_dir.mkdir(parents=True, exist_ok=True)
    hour_key = datetime.now(timezone.utc).strftime("%Y%m%d_%H")
    cache_file = cache_dir / f"{city.replace(' ', '_')}_{hour_key}.parquet"

    if cache_file.exists():
        df_fc = pd.read_parquet(cache_file)
    else:
        try:
            r = requests.get(
                OWM_FORECAST_URL,
                params={"lat": lat, "lon": lon, "appid": key, "units": "metric"},
                timeout=10,
            )
            r.raise_for_status()
            data = r.json()
            rows = []
            for item in data["list"]:
                rows.append({
                    "datetime":    pd.to_datetime(item["dt"], unit="s"),
                    "temperature": item["main"]["temp"],
                    "humidity":    item["main"]["humidity"],
                    "pressure":    item["main"]["pressure"],
                    "wind_speed":  item["wind"]["speed"],
                    "clouds":      item["clouds"]["all"],
                })
            df_fc = pd.DataFrame(rows)
            df_fc.to_parquet(cache_file, index=False)
        except Exception as e:
            logger.warning(f"OWM forecast error {city}: {e}")
            return {}

    t_now = pd.Timestamp.now().floor("h")
    df_fc = df_fc.sort_values("datetime").set_index("datetime")

    # Interpolation horaire
    hourly_idx = pd.date_range(
        t_now + pd.Timedelta(hours=1),
        t_now + pd.Timedelta(hours=max(weather_horizons)),
        freq="h",
    )
    WEATHER_COLS = ["temperature", "humidity", "pressure", "wind_speed", "clouds"]
    cols_ok = [c for c in WEATHER_COLS if c in df_fc.columns]
    df_interp = (
        df_fc[cols_ok]
        .reindex(df_fc.index.union(hourly_idx))
        .interpolate(method="time")
        .loc[hourly_idx]
    )

    result = {}
    for h in weather_horizons:
        t_h = t_now + pd.Timedelta(hours=h)
        if t_h in df_interp.index:
            result[h] = df_interp.loc[t_h].to_dict()

    return result
