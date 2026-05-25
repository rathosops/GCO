#!/bin/sh
set -eu

# =====================================================
# Entrypoint - CMI-PCG Backend
# =====================================================

POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
FLASK_ENV="${FLASK_ENV:-development}"
AUTO_SEED="${AUTO_SEED:-false}"

# -----------------------------------------------------
# Logs
# -----------------------------------------------------
info()  { echo "\033[0;32m[INFO]\033[0m $1"; }
warn()  { echo "\033[1;33m[WARN]\033[0m $1"; }
error() { echo "\033[0;31m[ERROR]\033[0m $1"; }

# =====================================================
# 1. Aguardar Postgres
# =====================================================
info "Aguardando Postgres..."

READY="false"
for i in $(seq 1 30); do
  if nc -z "$POSTGRES_HOST" "$POSTGRES_PORT"; then
    READY="true"
    info "Postgres disponível"
    break
  fi
  warn "Postgres indisponível ($i/30)"
  sleep 1
done

if [ "$READY" != "true" ]; then
  error "Postgres não ficou disponível a tempo"
  exit 1
fi

# =====================================================
# 2. Migrações (ÚNICA FONTE DA VERDADE)
# =====================================================
info "Executando migrações (advisory lock)..."

python app/scripts/run_migrations.py || {
  error "Falha ao executar migrações"
  exit 1
}

# =====================================================
# 3. Seed inicial (opcional)
# =====================================================
# Precisa de FLASK_APP para comandos flask
export FLASK_APP="app.app_factory:create_app"

if [ "$AUTO_SEED" = "true" ]; then
  info "Executando seed inicial"
  flask seed-auth || warn "Seed falhou"
fi

# =====================================================
# 4. Start app
# =====================================================
if [ "$FLASK_ENV" = "production" ]; then
  info "Iniciando em produção (Gunicorn)"
  exec gunicorn \
    "app.app_factory:create_app()" \
    --bind 0.0.0.0:5000 \
    --workers "${GUNICORN_WORKERS:-4}" \
    --timeout "${GUNICORN_TIMEOUT:-120}"
else
  info "Iniciando em desenvolvimento (Flask)"
  exec flask run --host=0.0.0.0 --port=5000
fi
