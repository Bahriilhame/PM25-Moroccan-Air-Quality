---
title: PM2.5 Moroccan Air Quality
emoji: 🌬️
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: true
license: mit
---

# PM2.5 Moroccan Air Quality — MLOps Pipeline

Prédiction temps réel de la pollution PM2.5 pour **53 villes marocaines**, horizon **H+1 → H+24**.

## Modèle : Blend Enrichi V2
- LightGBM + CatBoost avec poids optimisés Nelder-Mead
- Prévisions météo futures OWM (horizons 1,2,3,6,9,12,15,18,21,24h)
- Collecte automatique toutes les heures via OpenWeatherMap

## Dataset
Les données et modèles sont stockés dans le dataset HuggingFace :
[bahriilhame/pm25-moroccan-data](https://huggingface.co/datasets/bahriilhame/pm25-moroccan-data)
