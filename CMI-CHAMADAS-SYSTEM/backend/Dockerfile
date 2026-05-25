FROM python:3.13-slim-bookworm

WORKDIR /app

# Dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    tzdata \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Configurações Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código fonte
COPY . .

# Criar diretório de logs
RUN mkdir -p /app/logs

EXPOSE 5001

CMD ["uvicorn", "app.main:app", "--host=0.0.0.0", "--port=5001"]
