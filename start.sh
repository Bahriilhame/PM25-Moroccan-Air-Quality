#!/bin/bash
set -e

echo "=================================================="
echo "  PM2.5 Moroccan Air Quality - HuggingFace Space"
echo "=================================================="

# Nginx sert le frontend React sur /  et proxy /api/ → FastAPI

echo "=== NGINX STATUS ==="
ps aux | grep nginx

echo "=== PORTS ==="
ss -lntp

# FastAPI sur port 8000 (interne)
cd /app
exec python main.py
