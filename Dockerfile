# ── Stage 1 : Build React ─────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend-build

COPY frontend/package*.json ./
RUN npm ci --silent

COPY frontend/ ./
RUN npm run build

# ── Stage 2 : Python + Nginx ──────────────────────────────────────────────────
FROM python:3.11-slim

# Nginx pour servir le frontend
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx curl build-essential git-lfs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dépendances Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code backend
COPY backend/ .

# Frontend buildé
COPY --from=frontend-builder /frontend-build/dist /app/static

# Config Nginx
COPY nginx.conf /etc/nginx/sites-enabled/default

# Répertoires de données
RUN mkdir -p /app/data /app/models /app/logs /app/cache

# Script de démarrage
COPY start.sh /start.sh
RUN chmod +x /start.sh

# HF Space tourne sur le port 7860
EXPOSE 7860

CMD ["/start.sh"]
