# GCO V2

Sistema de chamadas para recepcao, triagem, consultorios e painel de TV.

A versao 2.0 esta sendo reconstruida como um monolito modular: FastAPI concentra o backend e o fluxo de chamadas; Next.js entrega as telas; PostgreSQL persiste o estado; Redis distribui eventos em tempo real; Nginx expoe uma porta unica.

## Stack

- Python 3.14, FastAPI, SQLAlchemy 2, Alembic e Ruff.
- Next.js, React e TypeScript.
- PostgreSQL, Redis e Nginx.
- Docker Compose para desenvolvimento e operacao local.

## Estrutura

```text
backend/        API FastAPI, dominios, migrations e comandos
frontend/       Aplicacao Next.js com App Router
infra/nginx/    Gateway HTTP e WebSocket
docs/           SDD e documentos de arquitetura
.github/        CI/CD, Dependabot e templates de colaboracao
```

## Subir localmente

1. Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

2. Ajuste `SECRET_KEY` e senhas no `.env`.

3. Suba a stack:

```bash
docker compose up --build -d
```

4. Aplique migrations:

```bash
docker compose exec api alembic upgrade head
```

5. Crie um administrador:

```bash
docker compose exec \
  -e GCO_ADMIN_USERNAME=admin \
  -e GCO_ADMIN_DISPLAY_NAME=Administrador \
  -e GCO_ADMIN_PASSWORD='troque-esta-senha' \
  api python -m app.commands.create_admin
```

6. Acesse:

```text
http://localhost:8080
```

## Rotas principais

- `/login`: autenticacao de operadores.
- `/operador`: fila, cadastro rapido de paciente e chamadas.
- `/triagem`: conclusao de triagem.
- `/admin`: cadastro minimo de salas.
- `/painel`: painel publico para TV.
- `/api/health`: healthcheck simples.
- `/api/health/ready`: readiness com PostgreSQL e Redis.

## Qualidade

Backend:

```bash
cd backend
python -m pip install -e ".[dev]"
ruff format --check .
ruff check .
alembic upgrade head
alembic check
pytest
```

Frontend:

```bash
cd frontend
npm install
npm run lint
npm run typecheck
npm run build
```

Docker:

```bash
docker compose config
docker compose build api web
```

## CI/CD

O repositorio inclui:

- `.github/workflows/ci.yml`: lint, typecheck, migrations, testes e build Docker.
- `.github/workflows/cd.yml`: publicacao manual ou por tag `v*` de imagens `api` e `web` no GitHub Container Registry.
- `.github/dependabot.yml`: atualizacoes semanais para GitHub Actions, Python, npm, Dockerfiles e Docker Compose.

## Documentacao

O plano tecnico da reestruturacao esta em:

- `docs/SDD_REESTRUTURACAO_V2.md`
- `docs/REFATORACAO_MONOLITO_MODULAR_V2.md`

Toda fase estrutural deve atualizar o SDD quando alterar contrato, arquitetura, dependencias ou criterios de aceite.
