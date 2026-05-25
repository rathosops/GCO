# GCO V2

GCO e uma plataforma white-label para gerenciamento de clinicas ocupacionais
brasileiras. A V2 esta sendo reconstruida como um monolito modular com FastAPI,
Next.js, PostgreSQL, Redis e Nginx.

O objetivo e entregar um ambiente completo para a rotina da clinica, desde o
agendamento ate a consulta, documentos, financeiro e painel de chamadas para TV.

## Escopo do produto

- Administracao, usuarios, papeis, permissoes e auditoria.
- Perfil white-label da clinica: nome, logo, tema, dados fiscais e parametros.
- Pacientes, profissionais, empresas, setores, cargos, convenios e fornecedores.
- Agendamentos, triagem, consultas, prontuario e painel de chamadas em tempo real.
- ASO, questionarios ocupacionais, riscos, exames periodicos e documentos NR-7.
- Receituarios, solicitacoes de exames, documentos livres e PDFs.
- Financeiro, pagamentos, despesas, DRE, relatorios e faturamento posterior.
- Farmacia, medicamentos, lotes, estoque, dispensacao e alertas.
- Integracoes brasileiras: CEP, NFS-e, importacoes CSV/XLSX/PDF e webhooks.

## Arquitetura

A entrega continua simples para operacao local ou Raspberry Pi:

```text
Cliente / TV / Operador / Admin
        |
        v
      Nginx
   /    |     \
 Web  /api   /ws
Next FastAPI FastAPI WebSocket
        |
        +--> PostgreSQL
        |
        +--> Redis
```

Backend:

- Python 3.14.
- FastAPI.
- SQLAlchemy 2.x.
- Alembic.
- Ruff e pytest.
- Modulos por dominio em `backend/app/modules`.

Frontend:

- Next.js com App Router.
- TypeScript estrito.
- Rotas administrativas, operacionais e painel publico.
- API client centralizado.
- Menus e acoes controlados por permissoes.

Infra:

- Docker Compose.
- Nginx como porta publica unica.
- PostgreSQL como fonte de verdade.
- Redis para cache, pub/sub e jobs leves.

## Estrutura

```text
backend/              API FastAPI V2
frontend/             Aplicacao Next.js V2
infra/nginx/          Gateway HTTP e WebSocket
docs/                 SDDs, arquitetura e guias de migracao
CMI-PCG-SERVER/       Backend legado Flask usado apenas como fonte de requisitos
CMI-PCG-FRONTEND/     Frontend legado Vite usado apenas como fonte de requisitos
CMI-CHAMADAS-SYSTEM/  Sistema de chamadas legado/prototipo
.github/              CI/CD, Dependabot e templates
```

As pastas legadas permanecem no repositorio somente para consulta durante a
migracao. A V2 nao deve copiar a arquitetura Flask/MVC nem manter branding
amarrado a uma clinica especifica.

## Modulos alvo

- `tenant`: perfil da clinica e white-label.
- `identity`: autenticacao, papeis e permissoes.
- `patients`: pacientes.
- `professionals`: medicos, enfermeiros, atendentes e assistentes sociais.
- `companies`: empresas, setores, cargos e vinculos.
- `appointments`: agenda.
- `calls`: painel de chamadas e tempo real.
- `clinical_records`: consultas e prontuario.
- `occupational_health`: ASO, riscos e questionarios.
- `exams`: catalogo e solicitacoes de exames.
- `prescriptions`: receituarios.
- `documents`: PDFs e documentos livres.
- `finance`: pagamentos, despesas, DRE e analytics.
- `billing`: faturamento posterior e recibos.
- `inventory`: farmacia e estoque.
- `reports`: relatorios e exportacoes.
- `integrations`: CEP, NFS-e, webhooks e notificacoes.
- `audit`: trilha de auditoria.

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

6. Configure o perfil white-label inicial da clinica:

```bash
docker compose exec \
  -e GCO_TENANT_TRADE_NAME='Clinica Exemplo' \
  -e GCO_TENANT_TIMEZONE=America/Sao_Paulo \
  api python -m app.commands.upsert_tenant_profile
```

7. Acesse:

```text
http://localhost:8080
```

## Rotas atuais da V2

- `/login`: autenticacao.
- `/operador`: operacao de chamadas.
- `/triagem`: conclusao de triagem.
- `/admin`: administracao minima atual.
- `/painel`: painel publico para TV.
- `/api/health`: healthcheck simples.
- `/api/health/ready`: readiness com PostgreSQL e Redis.
- `/api/v1/tenant/profile`: perfil white-label publico da instalacao.

Novas rotas administrativas e clinicas serao adicionadas conforme o SDD de
migracao do superservidor.

## Qualidade

Backend:

```bash
cd backend
python -m pip install -e ".[dev]"
python -m ruff format --check .
python -m ruff check .
alembic upgrade head
alembic check
python -m pytest
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
docker compose up -d
```

## Documentacao

Documentos principais:

- `docs/SDD_REESTRUTURACAO_V2.md`
- `docs/SDD_MIGRACAO_SUPERSERVIDOR_GCO.md`
- `docs/ARQUITETURA_GCO_SUPERSERVIDOR.md`
- `docs/MAPA_MODULOS_GCO.md`
- `docs/GUIA_IA_MIGRACAO_GCO.md`
- `docs/BOAS_PRATICAS_GCO.md`
- `docs/REFATORACAO_MONOLITO_MODULAR_V2.md`
- `docs/DEPLOY_V2.md`

Toda fase estrutural deve atualizar a documentacao quando alterar contrato,
arquitetura, dependencia ou criterio de aceite.

## Politica white-label

Codigo novo da V2 nao deve conter marca, logo, texto institucional, storage key,
servico Docker ou variavel operacional ligada a uma clinica especifica.

Antes de concluir fases de migracao, rode:

```bash
rg -n "CMI|Centro Medico|Centro Médico|logo_cmi|cmi_" backend frontend docs
```

Referencias ao nome legado sao permitidas apenas em documentos de analise ou nas
pastas legadas mantidas para consulta.

## CI/CD

O repositorio inclui:

- `.github/workflows/ci.yml`: lint, typecheck, migrations, testes e build Docker.
- `.github/workflows/cd.yml`: publicacao manual ou por tag `v*` de imagens `api`
  e `web` no GitHub Container Registry.
- `.github/dependabot.yml`: atualizacoes semanais para GitHub Actions, Python,
  npm, Dockerfiles e Docker Compose.
