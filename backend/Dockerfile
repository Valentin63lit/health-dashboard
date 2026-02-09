# Backend Dockerfile — Python 3.11+ slim
# Runs both the Telegram bot AND the scheduler in the same process.
# Production entry point: python -m backend.main run

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for Docker layer caching)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy application code
COPY backend/ ./backend/

# Create log directory
RUN mkdir -p /app/logs

# Set environment
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Production entry point: bot + scheduler
CMD ["python", "-m", "backend.main", "run"]
