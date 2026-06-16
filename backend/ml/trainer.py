"""
Entraînement / Fine-tune Blend Enrichi V2.
Appelé par le scheduler (fine-tune quotidien, full retrain hebdo)
ou via l'endpoint admin.
"""

import json
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor, Pool
from scipy.optimize import minimize
from sklearn.metrics import mean_absolute_error
from sklearn.preprocessing import LabelEncoder

from core.config import settings
from core.logger import get_logger
from ml.loader import HORIZONS, load_artefacts, init_artefacts

logger = get_logger(__name__)

WEATHER_COLS = ["temperature", "humidity", "wind_speed", "pressure", "clouds"]

LGB_PARAMS = dict(
    n_estimators=1000, learning_rate=0.05, num_leaves=127,
    max_depth=-1, min_child_samples=20, subsample=0.8,
    colsample_bytree=0.8, reg_alpha=0.1, reg_lambda=1.0,
    n_jobs=-1, random_state=settings.SEED, verbosity=-1,
)

CB_PARAMS = dict(
    iterations=1000, learning_rate=0.05, depth=7,
    l2_leaf_reg=3.0, loss_function="RMSE",
    random_seed=settings.SEED, verbose=0, task_type="CPU",
    early_stopping_rounds=50,
)


def _temporal_split(df: pd.DataFrame):
    dates = df["datetime"].sort_values().unique()
    n = len(dates)
    t_train = dates[int(n * 0.80)]
    t_val   = dates[int(n * 0.90)]
    return (
        df[df["datetime"] < t_train],
        df[(df["datetime"] >= t_train) & (df["datetime"] < t_val)],
        df[df["datetime"] >= t_val],
    )


def _build_features(df: pd.DataFrame, le: LabelEncoder = None):
    """Feature engineering complet pour l'entraînement."""
    from ml.features import WEATHER_COLS
    df = df.sort_values(["city", "datetime"]).copy()

    # Temporel
    df["hour"]       = df["datetime"].dt.hour
    df["dayofweek"]  = df["datetime"].dt.dayofweek
    df["month"]      = df["datetime"].dt.month
    df["day"]        = df["datetime"].dt.day
    df["weekofyear"] = df["datetime"].dt.isocalendar().week.astype(int)
    df["hour_sin"]   = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"]   = np.cos(2 * np.pi * df["hour"] / 24)
    df["dow_sin"]    = np.sin(2 * np.pi * df["dayofweek"] / 7)
    df["dow_cos"]    = np.cos(2 * np.pi * df["dayofweek"] / 7)
    df["month_sin"]  = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"]  = np.cos(2 * np.pi * df["month"] / 12)

    # Label encode city
    if le is None:
        le = LabelEncoder()
        df["city_enc"] = le.fit_transform(df["city"])
    else:
        df["city_enc"] = le.transform(df["city"])

    # Lags
    for lag in settings.LAGS_HOURS:
        tmp = df[["city", "datetime", "pm2_5"]].copy()
        tmp["datetime"] = tmp["datetime"] + pd.Timedelta(hours=lag)
        tmp = tmp.rename(columns={"pm2_5": f"pm25_lag_{lag}h"})
        df = df.merge(tmp, on=["city", "datetime"], how="left")

    # Rolling
    new_cols = {}
    for city_name, grp in df.groupby("city"):
        grp = grp.sort_values("datetime")
        s = grp.set_index("datetime")["pm2_5"].shift(1)
        for w in settings.ROLLING_WINDOWS:
            new_cols.setdefault(f"roll_mean_{w}h", {})[city_name] = s.rolling(w, min_periods=1).mean()
            new_cols.setdefault(f"roll_std_{w}h",  {})[city_name] = s.rolling(w, min_periods=1).std()
            new_cols.setdefault(f"roll_min_{w}h",  {})[city_name] = s.rolling(w, min_periods=1).min()
            new_cols.setdefault(f"roll_max_{w}h",  {})[city_name] = s.rolling(w, min_periods=1).max()

    # Merge rolling
    for col_name, city_data in new_cols.items():
        vals = pd.concat(city_data.values())
        df[col_name] = df.set_index(["city", "datetime"])["pm2_5"].map(
            lambda x: np.nan
        ).values  # placeholder
        for city_name, series in city_data.items():
            mask = df["city"] == city_name
            df.loc[mask, col_name] = series.values[:mask.sum()]

    # Changes + EWM
    df["pm25_change_1h"]  = df.groupby("city")["pm2_5"].diff(1)
    df["pm25_change_3h"]  = df["pm2_5"] - df.get("pm25_lag_3h",  df["pm2_5"])
    df["pm25_change_6h"]  = df["pm2_5"] - df.get("pm25_lag_6h",  df["pm2_5"])
    df["pm25_change_24h"] = df["pm2_5"] - df.get("pm25_lag_24h", df["pm2_5"])
    df["pm25_ewm_6h"]  = df.groupby("city")["pm2_5"].transform(lambda x: x.shift(1).ewm(span=6).mean())
    df["pm25_ewm_24h"] = df.groupby("city")["pm2_5"].transform(lambda x: x.shift(1).ewm(span=24).mean())
    df["temp_change_1h"]     = df.groupby("city")["temperature"].diff(1)
    df["humidity_change_1h"] = df.groupby("city")["humidity"].diff(1)

    # Moyennes historiques
    df["pm25_city_hour_mean"]  = df.groupby(["city", "hour"])["pm2_5"].transform(lambda x: x.shift(1).expanding().mean())
    df["pm25_city_dow_mean"]   = df.groupby(["city", "dayofweek"])["pm2_5"].transform(lambda x: x.shift(1).expanding().mean())
    df["pm25_city_month_mean"] = df.groupby(["city", "month"])["pm2_5"].transform(lambda x: x.shift(1).expanding().mean())

    # Interactions météo
    df["temp_humidity"] = df["temperature"] * df["humidity"]
    df["temp_wind"]     = df["temperature"] * df["wind_speed"]
    df["humidity_wind"] = df["humidity"]    * df["wind_speed"]

    # Prévisions météo futures (shifted depuis l'historique)
    for h in settings.WEATHER_HORIZONS:
        base = df[["city", "datetime"] + WEATHER_COLS].copy()
        base["datetime"] = base["datetime"] - pd.Timedelta(hours=h)
        base = base.rename(columns={c: f"{c}_fc_h{h}" for c in WEATHER_COLS})
        df = df.merge(base, on=["city", "datetime"], how="left")

    # Targets H+1→H+24
    for h in HORIZONS:
        tmp = df[["city", "datetime", "pm2_5"]].copy()
        tmp["datetime"] = tmp["datetime"] - pd.Timedelta(hours=h)
        tmp = tmp.rename(columns={"pm2_5": f"target_h{h}"})
        df = df.merge(tmp, on=["city", "datetime"], how="left")

    return df, le


def _optimize_blend(models_lgb, models_cb, df_val, feat_lgb, feat_cb, cat_feat):
    h = 1
    mask = df_val[f"target_h{h}"].notna()
    X_lgb = df_val.loc[mask, feat_lgb].fillna(0).values.astype(np.float32)
    cat_idx = [feat_cb.index(c) for c in cat_feat if c in feat_cb]
    pool_va = Pool(df_val.loc[mask, feat_cb].fillna(0), cat_features=cat_idx)
    p_lgb = models_lgb[h].predict(X_lgb)
    p_cb  = models_cb[h].predict(pool_va)
    y_true = df_val.loc[mask, f"target_h{h}"].values

    def loss(w):
        w = np.clip(w, 0, 1)
        w = w / w.sum()
        return mean_absolute_error(y_true, w[0] * p_lgb + w[1] * p_cb)

    res = minimize(loss, [0.5, 0.5], method="Nelder-Mead")
    w = np.clip(res.x, 0, 1)
    w = w / w.sum()
    logger.info(f"Blend weights: LGB={w[0]:.3f} CB={w[1]:.3f}")
    return w


def _save_artefacts(models_lgb, models_cb, blend_w, le, feat_lgb, feat_cb, cat_feat, models_dir: Path):
    lgb_dir = models_dir / "lgb_enriched"
    cb_dir  = models_dir / "cb_enriched"
    lgb_dir.mkdir(parents=True, exist_ok=True)
    cb_dir.mkdir(parents=True, exist_ok=True)

    for h in HORIZONS:
        models_lgb[h].save_model(str(lgb_dir / f"lgb_h{h}.txt"))
        models_cb[h].save_model(str(cb_dir  / f"cb_h{h}.cbm"))

    np.save(models_dir / "blend_weights_v2.npy", blend_w)
    joblib.dump(le,       models_dir / "label_encoder.pkl")
    joblib.dump(feat_lgb, models_dir / "feat_enriched.pkl")
    joblib.dump(feat_cb,  models_dir / "feat_cb_enriched.pkl")
    joblib.dump(cat_feat, models_dir / "cat_features.pkl")
    joblib.dump(settings.WEATHER_HORIZONS, models_dir / "weather_horizons.pkl")
    logger.info(f"Artefacts sauvegardés: {models_dir}")


def full_retrain(df_raw: pd.DataFrame) -> dict:
    """Full retrain Blend Enrichi V2 sur tout l'historique."""
    logger.info(f"=== FULL RETRAIN — {len(df_raw):,} lignes ===")
    models_dir = settings.MODELS_DIR

    df, le = _build_features(df_raw)
    df_train, df_val, df_test = _temporal_split(df)

    # Features
    exclude = {"city", "datetime", "pm2_5", "lat", "lon"} | {f"target_h{h}" for h in HORIZONS}
    feat_lgb = [c for c in df_train.columns if c not in exclude and c != "city"]
    feat_cb  = [c for c in df_train.columns if c not in exclude]
    cat_feat = ["city"] if "city" in feat_cb else []

    # Train LGB
    models_lgb = {}
    for h in HORIZONS:
        mask_tr = df_train[f"target_h{h}"].notna()
        mask_va = df_val[f"target_h{h}"].notna()
        ds_tr = lgb.Dataset(df_train.loc[mask_tr, feat_lgb].fillna(0).values.astype(np.float32),
                            label=df_train.loc[mask_tr, f"target_h{h}"].values)
        ds_va = lgb.Dataset(df_val.loc[mask_va, feat_lgb].fillna(0).values.astype(np.float32),
                            label=df_val.loc[mask_va, f"target_h{h}"].values, reference=ds_tr)
        model = lgb.train(LGB_PARAMS, ds_tr, valid_sets=[ds_va],
                          callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(-1)])
        models_lgb[h] = model
        logger.info(f"LGB H+{h:02d} best_iter={model.best_iteration}")

    # Train CB
    models_cb = {}
    cat_idx = [feat_cb.index(c) for c in cat_feat if c in feat_cb]
    for h in HORIZONS:
        mask_tr = df_train[f"target_h{h}"].notna()
        mask_va = df_val[f"target_h{h}"].notna()
        pool_tr = Pool(df_train.loc[mask_tr, feat_cb].fillna(0), label=df_train.loc[mask_tr, f"target_h{h}"], cat_features=cat_idx)
        pool_va = Pool(df_val.loc[mask_va, feat_cb].fillna(0),   label=df_val.loc[mask_va, f"target_h{h}"],   cat_features=cat_idx)
        model = CatBoostRegressor(**CB_PARAMS)
        model.fit(pool_tr, eval_set=pool_va, use_best_model=True)
        models_cb[h] = model
        logger.info(f"CB  H+{h:02d}")

    # Blend weights
    blend_w = _optimize_blend(models_lgb, models_cb, df_val, feat_lgb, feat_cb, cat_feat)

    # Eval test
    mae_blend = []
    feat_lgb_arr = [c for c in feat_lgb if c in df_test.columns]
    for h in HORIZONS:
        mask_te = df_test[f"target_h{h}"].notna()
        if not mask_te.any():
            continue
        X = df_test.loc[mask_te, feat_lgb_arr].fillna(0).values.astype(np.float32)
        pool = Pool(df_test.loc[mask_te, feat_cb].fillna(0), cat_features=cat_idx)
        p = np.clip(blend_w[0] * models_lgb[h].predict(X) + blend_w[1] * models_cb[h].predict(pool), 0, None)
        mae_blend.append(mean_absolute_error(df_test.loc[mask_te, f"target_h{h}"].values, p))

    mean_mae = float(np.mean(mae_blend)) if mae_blend else None
    logger.info(f"Test MAE Blend: {mean_mae:.3f}")

    _save_artefacts(models_lgb, models_cb, blend_w, le, feat_lgb, feat_cb, cat_feat, models_dir)

    # Recharger dans le singleton
    artefacts = load_artefacts(models_dir)
    if artefacts:
        init_artefacts(artefacts)

    return {"mae_blend": mean_mae, "blend_weights": blend_w.tolist()}


def fine_tune(df_recent: pd.DataFrame) -> dict:
    """Fine-tune quotidien sur les 30 derniers jours."""
    logger.info(f"=== FINE-TUNE — {len(df_recent):,} lignes ===")
    ft_lgb = {**LGB_PARAMS, "learning_rate": 0.01, "n_estimators": 300}
    ft_cb  = {**CB_PARAMS,  "learning_rate": 0.01, "iterations": 300}

    # Réutiliser le label encoder existant
    artefacts = load_artefacts(settings.MODELS_DIR)
    le = artefacts["label_encoder"] if artefacts else None

    df, le = _build_features(df_recent, le=le)
    df_train, df_val, _ = _temporal_split(df)

    exclude = {"city", "datetime", "pm2_5", "lat", "lon"} | {f"target_h{h}" for h in HORIZONS}
    feat_lgb = [c for c in df_train.columns if c not in exclude and c != "city"]
    feat_cb  = [c for c in df_train.columns if c not in exclude]
    cat_feat = ["city"] if "city" in feat_cb else []
    cat_idx  = [feat_cb.index(c) for c in cat_feat if c in feat_cb]

    models_lgb, models_cb = {}, {}
    for h in HORIZONS:
        mask_tr = df_train[f"target_h{h}"].notna()
        mask_va = df_val[f"target_h{h}"].notna()
        ds_tr = lgb.Dataset(df_train.loc[mask_tr, feat_lgb].fillna(0).values.astype(np.float32),
                            label=df_train.loc[mask_tr, f"target_h{h}"].values)
        ds_va = lgb.Dataset(df_val.loc[mask_va, feat_lgb].fillna(0).values.astype(np.float32),
                            label=df_val.loc[mask_va, f"target_h{h}"].values, reference=ds_tr)
        models_lgb[h] = lgb.train(ft_lgb, ds_tr, valid_sets=[ds_va],
                                   callbacks=[lgb.early_stopping(30, verbose=False), lgb.log_evaluation(-1)])

        pool_tr = Pool(df_train.loc[mask_tr, feat_cb].fillna(0), label=df_train.loc[mask_tr, f"target_h{h}"], cat_features=cat_idx)
        pool_va = Pool(df_val.loc[mask_va, feat_cb].fillna(0),   label=df_val.loc[mask_va, f"target_h{h}"],   cat_features=cat_idx)
        m = CatBoostRegressor(**ft_cb)
        m.fit(pool_tr, eval_set=pool_va, use_best_model=True)
        models_cb[h] = m

    blend_w = _optimize_blend(models_lgb, models_cb, df_val, feat_lgb, feat_cb, cat_feat)
    _save_artefacts(models_lgb, models_cb, blend_w, le, feat_lgb, feat_cb, cat_feat, settings.MODELS_DIR)

    artefacts = load_artefacts(settings.MODELS_DIR)
    if artefacts:
        init_artefacts(artefacts)

    return {"blend_weights": blend_w.tolist()}
