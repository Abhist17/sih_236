FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PACKAI_DATA_DIR=/app/data PACKAI_MODEL_DIR=/app/models PORT=8000
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY frontend ./frontend
COPY blockchain ./blockchain
COPY data/models ./models
WORKDIR /app/backend
EXPOSE 8000
HEALTHCHECK CMD python -c "import os,urllib.request;urllib.request.urlopen(f'http://localhost:{os.environ.get(\"PORT\",\"8000\")}/api/health')" || exit 1
# PACKAI_SEED_DEMO=1 fills an empty database with demo data (idempotent) before serving.
CMD ["sh", "-c", "if [ \"$PACKAI_SEED_DEMO\" = \"1\" ]; then python -m scripts.seed_demo; fi; exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
