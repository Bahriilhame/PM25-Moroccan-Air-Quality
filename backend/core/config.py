from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Secrets injectés par HuggingFace Space ────────────────────
    # Ces valeurs viennent de : HF Space → Settings → Repository secrets
    OWM_API_KEY: str = ""
    HF_TOKEN: str = ""
    HF_DATASET_REPO: str = "bahriilhame/pm25-moroccan-data"

    # ── App ───────────────────────────────────────────────────────
    PORT: int = 8000           # FastAPI interne (Nginx proxy → 7860)
    LOG_LEVEL: str = "INFO"

    # ── Paths dans le container HF Space ─────────────────────────
    DATA_DIR: Path = Path("/app/data")
    MODELS_DIR: Path = Path("/app/models")
    LOGS_DIR: Path = Path("/app/logs")
    CACHE_DIR: Path = Path("/app/cache")

    # ── Pipeline ─────────────────────────────────────────────────
    HORIZONS: list = list(range(1, 25))
    WEATHER_HORIZONS: list = [1, 2, 3, 6, 9, 12, 15, 18, 21, 24]
    LAGS_HOURS: list = [1, 2, 3, 6, 12, 24, 48, 72, 168, 336]
    ROLLING_WINDOWS: list = [3, 6, 12, 24, 48, 72, 168]
    SEED: int = 42

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    def setup_dirs(self):
        for d in [self.DATA_DIR, self.MODELS_DIR, self.LOGS_DIR, self.CACHE_DIR]:
            d.mkdir(parents=True, exist_ok=True)


settings = Settings()


def get_aqi_category(pm25: float) -> str:
    if pm25 < 15.0:
        return "Bon"
    elif pm25 < 35.0:
        return "Modéré"
    elif pm25 < 75.0:
        return "Mauvais"
    else:
        return "Très mauvais"


def get_aqi_color(category: str) -> str:
    return {
        "Bon":          "#2ECC71",
        "Modéré":       "#F39C12",
        "Mauvais":      "#E74C3C",
        "Très mauvais": "#8E44AD",
    }.get(category, "#95A5A6")
