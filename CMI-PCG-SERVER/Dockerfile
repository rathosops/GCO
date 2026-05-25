FROM python:3.12.3-slim-bookworm

# =====================================================
# Configurações base
# =====================================================
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1

# =====================================================
# Dependências do sistema
# =====================================================
# - netcat: wait-for db
# - libpq-dev/gcc: psycopg2
# - pango/cairo: weasyprint
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    tzdata \
    netcat-openbsd \
    libpq-dev \
    gcc \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# =====================================================
# Instala dependências Python
# =====================================================
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# =====================================================
# Copia aplicação
# =====================================================
COPY . .

# =====================================================
# Permissões
# =====================================================
RUN chmod +x entrypoint.sh \
    && find . -type f -name "*.sh" -exec chmod +x {} \;

EXPOSE 5000

ENTRYPOINT ["./entrypoint.sh"]
