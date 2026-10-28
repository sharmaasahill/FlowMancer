FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    CREWAI_DISABLE_TELEMETRY=true \
    OTEL_SDK_DISABLED=true
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Download the knowledge-base embedding model (~80 MB) at build time, so a restart doesn't fetch it again
RUN python -c "from chromadb.utils.embedding_functions import DefaultEmbeddingFunction as E; E()(['warm up'])"
COPY app/ ./app/
EXPOSE 8000
# Hosts such as Render set $PORT; locally and in docker-compose it is 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
