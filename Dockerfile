# ── Image unique Python + Nginx ───────────────────────────────────────────────
# Le frontend React est déjà buildé par GitHub Actions et poussé dans frontend/dist/
# Ce Dockerfile ne fait QUE copier le dist/ déjà prêt — pas de Node ici.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx curl build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dépendances Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code backend
COPY backend/ .

# Frontend déjà buildé (copié par GitHub Actions dans frontend/dist/)
COPY frontend/dist/ /app/static/

# Config Nginx
COPY nginx.conf /etc/nginx/sites-enabled/default

# Répertoires de données
RUN mkdir -p /app/data /app/models /app/logs /app/cache

# Script de démarrage
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 7860

CMD ["/start.sh"]