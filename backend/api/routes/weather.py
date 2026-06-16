"""
Route proxy météo — évite d'exposer la clé OWM côté frontend.
Ajouter dans main.py :
    from api.routes.weather import weather_router
    app.include_router(weather_router, prefix="/weather", tags=["Weather"])
"""

import httpx
from fastapi import APIRouter, HTTPException, Query
from core.config import settings

weather_router = APIRouter()

OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"


@weather_router.get("/forecast")
async def weather_forecast(
    lat: float = Query(...),
    lon: float = Query(...),
):
    """Proxy OWM forecast 5j/3h pour une position GPS."""
    if not settings.OWM_API_KEY:
        raise HTTPException(503, "OWM_API_KEY non configurée")

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(OWM_FORECAST_URL, params={
            "lat": lat, "lon": lon,
            "appid": settings.OWM_API_KEY,
            "units": "metric",
            "lang": "fr",
        })
        if r.status_code != 200:
            raise HTTPException(r.status_code, "Erreur OWM")
        return r.json()
