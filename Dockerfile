# ── Stage 1 : Build React ─────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend-build

COPY frontend/package*.json ./
RUN npm install --silent

COPY frontend/ ./
RUN npm run build

# ── Stage 2 : Python + Nginx ──────────────────────────────────────────────────
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx curl build-essential git-lfs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

COPY --from=frontend-builder /frontend-build/dist /app/static

COPY nginx.conf /etc/nginx/sites-enabled/default

RUN mkdir -p /app/data /app/models /app/logs /app/cache

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 7860

CMD ["/start.sh"]