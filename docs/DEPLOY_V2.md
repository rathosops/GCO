# Deploy V2

Comandos operacionais para subir o GCO V2 em ambiente local ou Raspberry Pi.

## 1. Preparar ambiente

Crie o arquivo `.env` a partir do exemplo e ajuste todos os valores sensiveis:

```bash
cp .env.example .env
```

Obrigatorio em producao:

- `APP_ENV=production`
- `SECRET_KEY` com pelo menos 32 caracteres aleatorios
- `POSTGRES_PASSWORD` forte
- `DATABASE_URL` usando a mesma senha do PostgreSQL
- `CORS_ORIGINS` restrito ao endereco real do servidor

Observacao sobre PostgreSQL:

- A stack de desenvolvimento usa `postgres:18-alpine` com volume montado em
  `/var/lib/postgresql`, layout recomendado para imagens PostgreSQL 18+.
- Ao atualizar um ambiente com dados reais de PostgreSQL 17 ou anterior para 18,
  execute plano explicito com backup e `pg_upgrade`. Em desenvolvimento, quando
  os dados puderem ser descartados, use `docker compose down -v` e recrie a
  stack.

Padroes recomendados para Raspberry Pi:

```env
API_WORKERS=1
DB_POOL_SIZE=3
DB_MAX_OVERFLOW=2
REDIS_MAXMEMORY=128mb
LOG_LEVEL=INFO
```

## 2. Subir stack

```bash
docker compose pull
docker compose up --build -d
```

Verifique a saude dos containers:

```bash
docker compose ps
docker compose exec api python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/api/health').read().decode())"
```

## 3. Aplicar banco

```bash
docker compose exec api alembic upgrade head
docker compose exec api alembic current
```

## 4. Criar admin inicial

Nunca use senha padrao. Defina a senha somente no ambiente do comando:

```bash
docker compose exec \
  -e GCO_ADMIN_USERNAME=admin \
  -e GCO_ADMIN_DISPLAY_NAME=Administrador \
  -e GCO_ADMIN_PASSWORD='defina-uma-senha-forte' \
  api python -m app.commands.create_admin
```

## 5. Validar aplicacao

```bash
docker compose exec api alembic check
```

No host, abra:

```text
http://localhost:8080
```

As verificacoes de qualidade devem rodar antes do deploy, no ambiente de
desenvolvimento ou CI:

```bash
cd backend
python -m pip install -e ".[dev]"
ruff format --check .
ruff check .
pytest

cd ../frontend
npm install
npm run lint
npm run typecheck
npm run build
```

## 6. Operacao

Logs:

```bash
docker compose logs -f gateway api web
```

Atualizacao:

```bash
docker compose pull
docker compose up --build -d
docker compose exec api alembic upgrade head
```

Backup simples do PostgreSQL:

```bash
docker compose exec postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup-gco.sql
```
