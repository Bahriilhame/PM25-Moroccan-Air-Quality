"""Tests unitaires — PM2.5 Moroccan Air Quality."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import numpy as np
import pandas as pd
import pytest

from core.cities import CITY_COORDS, CITIES
from core.config import get_aqi_category, get_aqi_color


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def small_history():
    """Historique minimal pour tester les features."""
    np.random.seed(42)
    dts = pd.date_range("2024-01-01", periods=200, freq="h")
    rows = []
    for city in ["Casablanca", "Rabat", "Fes"]:
        lat, lon = CITY_COORDS[city]
        for dt in dts:
            rows.append({
                "datetime":    dt,
                "city":        city,
                "lat":         lat,
                "lon":         lon,
                "pm2_5":       max(1.0, np.random.normal(15, 6)),
                "temperature": np.random.normal(20, 5),
                "humidity":    np.random.uniform(40, 90),
                "wind_speed":  abs(np.random.normal(3, 1.5)),
                "pressure":    np.random.normal(1013, 5),
                "clouds":      int(np.random.randint(0, 100)),
            })
    return pd.DataFrame(rows).sort_values(["city", "datetime"]).reset_index(drop=True)


# ── Tests villes ──────────────────────────────────────────────────────────────

def test_city_count():
    assert len(CITY_COORDS) == 53, f"Attendu 53 villes, trouvé {len(CITY_COORDS)}"

def test_city_coords_in_morocco():
    """Toutes les villes dans la bounding box Maroc."""
    for city, (lat, lon) in CITY_COORDS.items():
        assert 20.0 <= lat <= 36.5, f"{city} lat={lat} hors limites"
        assert -17.5 <= lon <= -1.0, f"{city} lon={lon} hors limites"

def test_cities_list():
    assert len(CITIES) == 53
    assert "Casablanca" in CITIES
    assert "Laayoune"   in CITIES
    assert "Dakhla"     in CITIES


# ── Tests AQI ─────────────────────────────────────────────────────────────────

def test_aqi_categories():
    assert get_aqi_category(5.0)   == "Bon"
    assert get_aqi_category(14.9)  == "Bon"
    assert get_aqi_category(15.0)  == "Modéré"
    assert get_aqi_category(34.9)  == "Modéré"
    assert get_aqi_category(35.0)  == "Mauvais"
    assert get_aqi_category(74.9)  == "Mauvais"
    assert get_aqi_category(75.0)  == "Très mauvais"
    assert get_aqi_category(200.0) == "Très mauvais"

def test_aqi_colors():
    import re
    hex_re = re.compile(r'^#[0-9A-Fa-f]{6}$')
    for cat in ["Bon", "Modéré", "Mauvais", "Très mauvais"]:
        color = get_aqi_color(cat)
        assert hex_re.match(color), f"Couleur invalide pour {cat}: {color}"

def test_aqi_unknown():
    color = get_aqi_color("Inconnu")
    assert color == "#95A5A6"


# ── Tests features ────────────────────────────────────────────────────────────

def test_inference_row_keys(small_history):
    """build_inference_row doit retourner un DataFrame avec les bonnes colonnes de base."""
    from core.config import settings
    from ml.features import build_inference_row
    from sklearn.preprocessing import LabelEncoder

    le = LabelEncoder()
    le.fit(CITIES)

    # Artefacts minimaux simulés
    artefacts = {
        "label_encoder":   le,
        "weather_horizons": [1, 3, 6],
        "feat_lgb": [],
        "feat_cb":  [],
    }

    city     = "Casablanca"
    t_now    = pd.Timestamp("2024-01-09 10:00:00")
    fc_vals  = {1: {"temperature": 22.0, "humidity": 60.0, "wind_speed": 3.0, "pressure": 1013.0, "clouds": 20}}

    row = build_inference_row(city, t_now, small_history, fc_vals, artefacts)

    assert isinstance(row, pd.DataFrame), "Doit retourner un DataFrame"
    assert len(row) == 1, "Doit avoir une seule ligne"

    # Colonnes temporelles obligatoires
    for col in ["hour", "dayofweek", "month", "hour_sin", "hour_cos"]:
        assert col in row.columns, f"Colonne manquante: {col}"

    # Lags
    assert "pm25_lag_1h"  in row.columns
    assert "pm25_lag_24h" in row.columns

    # Rolling
    assert "roll_mean_24h" in row.columns

    # EWM
    assert "pm25_ewm_6h"  in row.columns
    assert "pm25_ewm_24h" in row.columns

    # Heure correcte
    assert row["hour"].iloc[0] == 10

def test_inference_row_no_nan_temporel(small_history):
    """Les features temporelles ne doivent jamais être NaN."""
    from ml.features import build_inference_row
    from sklearn.preprocessing import LabelEncoder

    le = LabelEncoder()
    le.fit(CITIES)
    artefacts = {"label_encoder": le, "weather_horizons": [1], "feat_lgb": [], "feat_cb": []}

    row = build_inference_row(
        "Rabat",
        pd.Timestamp("2024-01-10 15:00:00"),
        small_history, {}, artefacts
    )
    for col in ["hour_sin", "hour_cos", "dow_sin", "dow_cos", "month_sin", "month_cos"]:
        assert not pd.isna(row[col].iloc[0]), f"{col} est NaN"


# ── Tests collecteur ──────────────────────────────────────────────────────────

def test_append_to_history(tmp_path, small_history):
    """append_to_history doit dédoublonner correctement."""
    import os
    os.environ["DATA_DIR"] = str(tmp_path)

    # Réimporter avec le nouveau chemin
    from core.config import Settings
    s = Settings(DATA_DIR=tmp_path)
    s.setup_dirs()

    hist_path = tmp_path / "history.csv"

    # Premier write
    small_history.to_csv(hist_path, index=False)
    n1 = len(small_history)

    # Deuxième write avec overlap
    from ml.collector import append_to_history
    # Simuler avec DATA_DIR patchée
    import ml.collector as col_mod
    orig = col_mod.settings.DATA_DIR
    col_mod.settings.DATA_DIR = tmp_path

    append_to_history(small_history)   # même données → pas de doublon

    df2 = pd.read_csv(hist_path, parse_dates=["datetime"])
    assert len(df2) == n1, f"Doublon détecté: attendu {n1}, trouvé {len(df2)}"

    col_mod.settings.DATA_DIR = orig
