# Plano de Refatoracao V2: Monolito Modular FastAPI + Next.js

Data do plano: 2026-05-25

## 1. Objetivo

Refatorar o sistema de chamadas para televisao em uma versao 2.0 limpa, sem compromisso com compatibilidade estrutural com a versao atual. O resultado deve ser um monolito modular, simples de entender, facil de customizar, otimizado para rodar em Raspberry Pi e sustentado por boas praticas de FastAPI, Python 3.14, PostgreSQL, Redis, Nginx, Docker, Next.js e TypeScript.

Este plano assume que o legado nao precisa ser preservado como arquitetura. Devemos reaproveitar apenas regras de negocio que continuem corretas:

- Painel de TV com chamadas em tempo real.
- Fluxo de operador/medico/triagem/admin.
- Historico de chamadas.
- Autenticacao e autorizacao.
- Integracao com agenda/pacientes, se ainda fizer parte do produto final.
- Audio, text-to-speech e comportamento de tela cheia para recepcao.

## 2. Pesquisa e referencias

Fontes principais usadas para orientar a proposta:

- FastAPI, aplicacoes maiores com `APIRouter` e multiplos arquivos: https://fastapi.tiangolo.com/tutorial/bigger-applications/
- FastAPI, configuracoes e variaveis de ambiente com Pydantic Settings: https://fastapi.tiangolo.com/advanced/settings/
- FastAPI, SQL databases: https://fastapi.tiangolo.com/tutorial/sql-databases/
- FastAPI, dependencies com `yield`: https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/
- FastAPI, WebSockets: https://fastapi.tiangolo.com/advanced/websockets/
- FastAPI, testes e override de dependencias: https://fastapi.tiangolo.com/advanced/testing-dependencies/
- Python 3.14, documentacao oficial: https://docs.python.org/3.14/
- PEP 8, guia oficial de estilo Python: https://peps.python.org/pep-0008/
- PEP 257, convencoes de docstrings: https://peps.python.org/pep-0257/
- Ruff, configuracao oficial: https://docs.astral.sh/ruff/configuration/
- Docker, melhores praticas para Dockerfiles: https://docs.docker.com/develop/develop-images/dockerfile_best-practices/
- Docker, multi-stage builds: https://docs.docker.com/build/building/multi-stage/
- Next.js, App Router: https://nextjs.org/docs/app
- Next.js, TypeScript: https://nextjs.org/docs/app/building-your-application/configuring/typescript
- Next.js, output standalone: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- Nginx, proxy reverso: https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/
- Nginx, WebSocket proxying: https://nginx.org/en/docs/http/websocket.html
- Redis, documentacao oficial: https://redis.io/docs/latest/
- Redis, Pub/Sub: https://redis.io/docs/latest/develop/pubsub/
- PostgreSQL, identificadores e convencoes de nomes: https://www.postgresql.org/docs/current/sql-syntax-lexical.html
- PostgreSQL, constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL, indexes: https://www.postgresql.org/docs/current/indexes.html
- Alembic, naming conventions: https://alembic.sqlalchemy.org/en/latest/naming.html

Padroes observados em sistemas similares de filas/chamadas:

- Separacao clara entre painel publico de exibicao e telas autenticadas de operacao.
- WebSocket ou Server-Sent Events para propagacao imediata da chamada.
- Persistencia no banco para auditoria e historico.
- Redis para pub/sub, cache curto e coordenacao entre processos.
- Painel de TV resiliente: reconecta sozinho, tolera perda temporaria de rede, mostra ultimo estado conhecido e evita depender de interacao manual.
- Configuracao de salas, sons, limite de chamadas exibidas e textos por ambiente, nao no codigo.

## 3. Diagnostico do repositorio atual

Estruturas encontradas:

- `CMI-PCG-SERVER`: backend maior, com Flask, SQLAlchemy, Alembic, templates HTML, controllers, models, Redis/Celery e muitos dominios clinicos/financeiros.
- `CMI-PCG-FRONTEND`: frontend separado em Vite/React/TypeScript.
- `CMI-CHAMADAS-SYSTEM`: subsistema de chamadas ja em FastAPI + React/Vite, com backend, frontend, Docker, Redis e PostgreSQL compartilhados.

Pontos que devem ser corrigidos na V2:

- Backend e frontend de chamadas ainda estao separados como projeto independente.
- Ha valores chumbados: usuarios padrao, senhas padrao, salas, limites, portas, CORS, nomes de servicos, textos e timeouts.
- `create_all` no startup e criacao de dados padrao dentro da aplicacao acoplam runtime e schema.
- Alguns servicos usam SQL textual diretamente onde SQLAlchemy tipado seria mais seguro e testavel.
- O frontend usa Vite/React; a meta nova e Next.js com TypeScript.
- A organizacao atual mistura `models`, `schemas`, `services`, `repositories` por camada global. Para o crescimento do produto, a V2 deve organizar por modulo de dominio.

## 4. Decisoes de arquitetura

### 4.1 Tipo de monolito

Adotar monolito modular em um unico repositorio e uma unica distribuicao de produto:

- Uma API FastAPI como backend principal.
- Um frontend Next.js como aplicacao web do mesmo produto.
- Um unico `docker-compose.yml` de producao local.
- Um unico namespace de configuracao.
- Modulos de dominio independentes dentro do backend.
- Nginx como porta de entrada unica.

Em producao no Raspberry Pi, a porta publica deve ser uma so:

- `/` serve o frontend.
- `/api/*` vai para FastAPI.
- `/ws/*` vai para FastAPI/WebSocket.
- `/health` mostra saude do gateway.

### 4.2 Runtime do frontend

Preferencia para Next.js com App Router, TypeScript e renderizacao estatica quando possivel.

Decisao recomendada:

- Usar Next.js App Router.
- Evitar Next API Routes; toda regra de negocio fica no FastAPI.
- Usar `output: "standalone"` se houver necessidade de SSR.
- Se o painel e telas forem majoritariamente client-side, avaliar `output: "export"` para gerar estaticos servidos por Nginx. Isso reduz consumo de CPU/RAM no Raspberry Pi.

Regra pratica:

- Comecar com Next.js standalone durante desenvolvimento.
- Medir no Raspberry Pi.
- Se SSR nao agregar valor real, converter para build estatico servido por Nginx.

### 4.3 Backend

FastAPI deve ser a borda HTTP/WebSocket. A logica de negocio deve ficar fora dos endpoints:

- `api`: rotas, dependencias HTTP, serializacao.
- `modules`: casos de uso, entidades, repositorios, schemas do dominio.
- `core`: configuracao, banco, seguranca, observabilidade, Redis.
- `shared`: utilitarios sem dependencia de dominio.

Endpoints devem ser finos. Services/use cases devem receber dependencias explicitas. Repositorios devem isolar persistencia. Models SQLAlchemy nao devem virar objetos "Deus".

### 4.4 Banco de dados

PostgreSQL deve ser a fonte de verdade.

Decisao recomendada:

- SQLAlchemy 2.x com tipos `Mapped` e `mapped_column`.
- Alembic para criar schema da V2 a partir de uma base limpa.
- Nomes em `snake_case`, minusculos e sem aspas.
- Tabelas no plural ou singular devem seguir uma regra unica. Recomendacao: plural em portugues ou ingles, mas nao misturar. Para novo codigo, preferir nomes em ingles tecnico ou portugues de negocio. Escolher uma lingua e manter.
- UUID ou BIGINT devem ser decididos por necessidade real. Para Raspberry Pi e simplicidade local, `bigint generated by default as identity` e suficiente.
- Timestamps timezone-aware, armazenados como `timestamptz`.
- Constraints e indexes nomeados por convencao.

### 4.5 Redis

Redis deve ser usado para dados volateis, nunca como fonte unica de verdade:

- Pub/Sub para broadcast de chamadas.
- Cache curto para painel, agenda do dia e configuracoes.
- Rate limiting simples, se necessario.
- Deduplicacao temporaria de eventos, se necessario.

Nao usar Redis para historico permanente de chamadas.

### 4.6 Nginx

Nginx deve ser a entrada unica e simples:

- Servir assets do Next.
- Proxy `/api/` para FastAPI.
- Proxy `/ws/` com headers de upgrade.
- Gzip/brotli quando disponivel.
- Cache agressivo para assets versionados.
- Timeouts adequados para WebSocket.

### 4.7 Docker

Principios:

- Imagens pequenas.
- Multi-stage builds.
- Usuario nao-root.
- Dependencias pinadas.
- Healthchecks reais.
- Separar imagem de desenvolvimento e producao quando necessario.
- Evitar bind mounts em producao.
- Suporte a `linux/arm64` e `linux/arm/v7` conforme o Raspberry Pi alvo.

## 5. Estrutura proposta

```text
gco/
├── README.md
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .dockerignore
├── docs/
│   ├── REFATORACAO_MONOLITO_MODULAR_V2.md
│   ├── ADR-0001-monolito-modular.md
│   ├── ADR-0002-modelagem-postgresql.md
│   └── API.md
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py
│   │   │   ├── errors.py
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── router.py
│   │   │       ├── auth.py
│   │   │       ├── calls.py
│   │   │       ├── rooms.py
│   │   │       ├── queue.py
│   │   │       ├── panel.py
│   │   │       ├── settings.py
│   │   │       └── websocket.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── constants.py
│   │   │   ├── database.py
│   │   │   ├── logging.py
│   │   │   ├── redis.py
│   │   │   ├── security.py
│   │   │   └── lifespan.py
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── models.py
│   │   │   │   ├── schemas.py
│   │   │   │   ├── repository.py
│   │   │   │   ├── service.py
│   │   │   │   └── permissions.py
│   │   │   ├── calls/
│   │   │   │   ├── constants.py
│   │   │   │   ├── events.py
│   │   │   │   ├── models.py
│   │   │   │   ├── schemas.py
│   │   │   │   ├── repository.py
│   │   │   │   ├── service.py
│   │   │   │   └── broadcaster.py
│   │   │   ├── rooms/
│   │   │   ├── appointments/
│   │   │   ├── triage/
│   │   │   ├── media/
│   │   │   └── audit/
│   │   ├── shared/
│   │   │   ├── pagination.py
│   │   │   ├── result.py
│   │   │   ├── time.py
│   │   │   └── validators.py
│   │   └── worker/
│   │       └── tasks.py
│   └── tests/
│       ├── conftest.py
│       ├── unit/
│       ├── integration/
│       └── e2e/
├── frontend/
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── painel/page.tsx
│   │   │   ├── operador/page.tsx
│   │   │   ├── triagem/page.tsx
│   │   │   └── admin/page.tsx
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── calls/
│   │   │   ├── auth/
│   │   │   ├── panel/
│   │   │   └── rooms/
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── config.ts
│   │   │   ├── websocket.ts
│   │   │   └── sound.ts
│   │   └── types/
│   └── public/
│       ├── logo.png
│       └── sfx/
└── infra/
    ├── nginx/
    │   └── nginx.conf
    ├── postgres/
    │   └── init.sql
    └── scripts/
```

## 6. Modulos de dominio

### 6.1 Auth

Responsabilidades:

- Login.
- Hash de senha.
- Emissao e validacao de tokens.
- Perfis e permissoes.
- Usuario ativo/inativo.

Regras:

- Nao criar usuarios padrao no startup.
- Criar usuario inicial por comando explicito: `python -m app.worker.create_admin` ou task administrativa.
- Senhas padrao nunca entram no codigo.

### 6.2 Calls

Responsabilidades:

- Criar chamada.
- Rechamar paciente.
- Iniciar atendimento.
- Finalizar atendimento.
- Cancelar chamada.
- Registrar historico.
- Emitir evento para painel.

Estados sugeridos:

- `waiting`
- `called`
- `in_service`
- `completed`
- `no_show`
- `cancelled`

Eventos sugeridos:

- `call.created`
- `call.recalled`
- `call.started`
- `call.finished`
- `call.cancelled`
- `panel.refreshed`

### 6.3 Rooms

Responsabilidades:

- Cadastrar salas/consultorios/triagem.
- Configurar nome exibido no painel.
- Vincular usuario a sala, quando aplicavel.

### 6.4 Appointments

Responsabilidades:

- Fonte de pacientes aguardando.
- Integracao com agenda local ou futura API do sistema principal.
- Normalizacao de dados necessarios para o painel.

Para a V2, decidir se agenda faz parte do mesmo banco ou se sera adaptador externo. O codigo deve esconder isso atras de uma interface simples:

```python
class AppointmentGateway(Protocol):
    def get_waiting_today(self) -> list[AppointmentSummary]: ...
    def mark_attendance(self, appointment_id: int, attended: bool) -> None: ...
```

### 6.5 Triage

Responsabilidades:

- Controlar fluxo de triagem antes da chamada medica.
- Registrar observacoes.
- Impedir chamada medica quando a regra exigir triagem previa.

### 6.6 Panel

Responsabilidades:

- Estado atual do painel.
- Limite de chamadas exibidas.
- Historico curto.
- Configuracoes visuais e sonoras.
- Broadcast em tempo real.

## 7. Modelagem PostgreSQL

### 7.1 Convencoes

Regras obrigatorias:

- Tabelas e colunas em `snake_case`.
- Nomes minusculos e sem aspas.
- Chaves primarias: `id`.
- Chaves estrangeiras: `{entidade}_id`.
- Timestamps: `created_at`, `updated_at`, `deleted_at` quando soft delete for necessario.
- Booleanos com prefixo claro: `is_active`, `is_default`, `requires_triage`.
- Enums pequenos podem ser `CHECK` ou enum PostgreSQL. Para estados de dominio estaveis, enum PostgreSQL e aceitavel. Para valores configuraveis pelo cliente, usar tabela.
- Dinheiro deve usar `numeric(12, 2)`, nunca `float`.
- CPF, telefone, CEP e codigos devem ser texto, nao numero.

### 7.2 Naming convention para constraints

Configurar no `Base.metadata`:

```python
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}
```

### 7.3 Tabelas iniciais sugeridas

`users`

- `id bigint primary key`
- `username varchar(80) unique not null`
- `display_name varchar(120) not null`
- `password_hash text not null`
- `role user_role not null`
- `is_active boolean not null default true`
- `last_login_at timestamptz`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

`rooms`

- `id bigint primary key`
- `code varchar(30) unique not null`
- `name varchar(80) not null`
- `display_name varchar(80) not null`
- `kind room_kind not null`
- `is_active boolean not null default true`
- `sort_order integer not null default 0`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

`appointments`

- `id bigint primary key`
- `patient_name varchar(160) not null`
- `patient_document varchar(20)`
- `scheduled_for timestamptz not null`
- `status appointment_status not null`
- `requires_triage boolean not null default false`
- `external_source varchar(40)`
- `external_id varchar(80)`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

`calls`

- `id bigint primary key`
- `appointment_id bigint not null references appointments(id)`
- `room_id bigint references rooms(id)`
- `called_by_user_id bigint references users(id)`
- `status call_status not null`
- `kind call_kind not null`
- `sequence_number integer not null`
- `message varchar(180)`
- `called_at timestamptz not null`
- `started_at timestamptz`
- `finished_at timestamptz`
- `cancelled_at timestamptz`
- `notes text`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

`triage_records`

- `id bigint primary key`
- `appointment_id bigint unique not null references appointments(id)`
- `triaged_by_user_id bigint references users(id)`
- `status triage_status not null`
- `notes text`
- `completed_at timestamptz`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

`panel_settings`

- `id bigint primary key`
- `key varchar(80) unique not null`
- `value jsonb not null`
- `description text`
- `updated_at timestamptz not null`

`audit_logs`

- `id bigint primary key`
- `actor_user_id bigint references users(id)`
- `action varchar(80) not null`
- `entity_type varchar(80) not null`
- `entity_id varchar(80)`
- `payload jsonb`
- `created_at timestamptz not null`

### 7.4 Indexes iniciais

- `ix_calls_status_called_at` em `(status, called_at desc)`.
- `ix_calls_appointment_id` em `appointment_id`.
- `ix_appointments_scheduled_for_status` em `(scheduled_for, status)`.
- `ix_appointments_patient_name_trgm`, se busca por nome for requisito e extensao `pg_trgm` estiver habilitada.
- `ix_audit_logs_created_at` em `created_at desc`.

### 7.5 Valores de configuracao

Nao deixar estes valores no codigo:

- Limite de chamadas no painel.
- Tempo de exibicao de chamada.
- Intervalo de heartbeat do WebSocket.
- Salas padrao.
- Sons.
- Texto exibido no painel.
- Voz/idioma de text-to-speech.
- Origens CORS.
- Timezone.
- Usuario/senha inicial.

Classificacao:

- Variaveis de ambiente: secrets, URLs, ambiente, portas, CORS, flags de debug.
- Banco (`panel_settings`): preferencias operacionais editaveis pelo admin.
- Constantes Python: valores universais do dominio que nao variam por instalacao.

## 8. Padroes Python

### 8.1 Versao

Usar Python 3.14 na V2. Como boa pratica, confirmar compatibilidade das dependencias antes de congelar a imagem final:

- FastAPI.
- Pydantic.
- SQLAlchemy.
- Alembic.
- Uvicorn/Gunicorn.
- psycopg.
- redis-py.
- cryptography/passlib/argon2.

Se alguma dependencia critica ainda nao publicar wheel compativel com Python 3.14 para ARM, usar etapa temporaria com Python 3.13 e registrar ADR. A meta arquitetural permanece Python 3.14.

### 8.2 Estilo

Regras obrigatorias:

- PEP 8.
- PEP 257 para docstrings.
- Type hints em codigo de aplicacao.
- Funcoes curtas e coesas.
- Nomes explicitos.
- Evitar abreviacoes obscuras.
- Evitar classes sem estado real.
- Evitar herancas profundas.
- Preferir composicao.
- Preferir `Enum`/`StrEnum` para estados fechados.
- Usar excecoes de dominio, nao `ValueError` generico em regras centrais.

### 8.3 Docstrings

Docstrings devem explicar contrato e motivo quando nao for obvio. Nao repetir o nome da funcao em linguagem natural.

Exemplo bom:

```python
def create_call(command: CreateCallCommand) -> Call:
    """Registra uma chamada e publica o evento consumido pelo painel."""
```

Exemplo ruim:

```python
def create_call(command: CreateCallCommand) -> Call:
    """Cria chamada."""
```

### 8.4 Excecoes de dominio

Criar excecoes por modulo:

```python
class CallError(Exception):
    """Base para erros de chamadas."""


class AppointmentNotReadyForCallError(CallError):
    """A regra de negocio impede chamar este agendamento agora."""
```

Mapear no FastAPI:

- Erro de validacao de entrada: `422`.
- Recurso inexistente: `404`.
- Regra de negocio violada: `409`.
- Sem autenticacao: `401`.
- Sem permissao: `403`.

## 9. Ruff e qualidade

`backend/pyproject.toml` deve centralizar formato, lint e teste.

Configuracao base sugerida:

```toml
[project]
name = "gco-backend"
version = "2.0.0"
requires-python = ">=3.14"

[tool.ruff]
line-length = 88
target-version = "py314"
src = ["app", "tests"]

[tool.ruff.lint]
select = [
  "E",
  "F",
  "W",
  "I",
  "N",
  "UP",
  "B",
  "C4",
  "SIM",
  "RET",
  "ARG",
  "PTH",
  "ERA",
  "TRY",
  "RUF",
]
ignore = [
  "TRY003",
]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
line-ending = "lf"

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
```

Comandos padrao:

```bash
ruff check backend
ruff format backend
pytest backend/tests
```

## 10. Padroes FastAPI

### 10.1 `main.py`

`main.py` deve apenas montar a aplicacao:

- Criar `FastAPI`.
- Registrar lifespan.
- Registrar middlewares.
- Registrar handlers de erro.
- Incluir router versionado.

Nao deve:

- Criar tabelas.
- Criar usuarios.
- Conter regra de negocio.
- Abrir conexoes globais fora do lifespan/config.

### 10.2 Routers

Cada modulo expoe um router pequeno:

```python
router = APIRouter(prefix="/calls", tags=["calls"])
```

O agregador `api/v1/router.py` inclui todos:

```python
api_router.include_router(calls.router)
api_router.include_router(rooms.router)
api_router.include_router(panel.router)
```

### 10.3 Dependencies

Dependencias comuns:

- `get_settings`.
- `get_db_session`.
- `get_redis`.
- `get_current_user`.
- `require_permission`.

Sessao de banco deve usar dependency com `yield`, garantindo fechamento por request.

### 10.4 Schemas

Schemas Pydantic devem ser separados por intencao:

- `CallCreate`.
- `CallUpdate`.
- `CallRead`.
- `CallPanelItem`.
- `CallEvent`.

Nao usar o model SQLAlchemy como contrato de API.

## 11. Frontend Next.js

### 11.1 Estrutura

Usar App Router:

- `src/app/painel/page.tsx`: painel publico de TV.
- `src/app/login/page.tsx`: login.
- `src/app/operador/page.tsx`: fila e botoes de chamada.
- `src/app/triagem/page.tsx`: triagem.
- `src/app/admin/page.tsx`: configuracoes e monitoramento.

Feature folders:

- `features/calls`.
- `features/panel`.
- `features/auth`.
- `features/rooms`.

### 11.2 Estado e dados

Recomendacao:

- `fetch` nativo ou TanStack Query se o estado remoto crescer.
- WebSocket encapsulado em `lib/websocket.ts`.
- Tipos compartilhados gerados do OpenAPI quando possivel.
- Configuracao de API via variaveis `NEXT_PUBLIC_API_BASE_URL` e `NEXT_PUBLIC_WS_BASE_URL`, com padrao relativo `/api` e `/ws`.

### 11.3 Painel de TV

Requisitos de robustez:

- Reconectar WebSocket com backoff.
- Exibir ultimo estado conhecido.
- Tolerar modo tela cheia.
- Evitar scroll.
- Garantir alto contraste e leitura a distancia.
- Audio pre-carregado.
- Fallback visual quando audio for bloqueado pelo navegador.
- Relogio local.
- Indicador discreto de conexao.

### 11.4 TypeScript

Regras:

- `strict: true`.
- Nao usar `any` sem justificativa.
- Componentes pequenos.
- Hooks para efeitos de WebSocket/audio.
- Separar componentes visuais de regras de API.

## 12. Docker Compose proposto

Servicos:

- `gateway`: Nginx.
- `api`: FastAPI.
- `web`: Next.js somente se usar SSR/standalone. Se build estatico, este servico desaparece e o Nginx serve os assets.
- `postgres`: PostgreSQL.
- `redis`: Redis.

Porta publica:

- `80:80` em producao local.
- Opcional `8080:80` em desenvolvimento para evitar conflito.

Volumes:

- `postgres_data`.
- `redis_data`, se persistencia Redis for habilitada.
- `app_uploads`, se houver upload de midia.

Healthchecks:

- API: `GET /api/health`.
- Nginx: `GET /health`.
- PostgreSQL: `pg_isready`.
- Redis: `redis-cli ping`.

## 13. Otimizacao para Raspberry Pi

### 13.1 Backend

- Uvicorn com poucos workers. Comecar com `1` worker.
- Pool PostgreSQL pequeno: `pool_size=3`, `max_overflow=2`.
- Timeouts curtos e queries indexadas.
- Evitar Celery se nao houver jobs pesados. Preferir tarefas leves com `BackgroundTasks` ou fila simples Redis.
- Logs em JSON opcionais, rotacao externa ou `max-size` no Docker.
- Nao ativar reload em producao.

### 13.2 Frontend

- Preferir build estatico se possivel.
- Otimizar imagens.
- Reduzir dependencias grandes.
- Evitar animacoes pesadas no painel.
- Pre-carregar somente assets usados.

### 13.3 PostgreSQL

- Configuracao conservadora de memoria.
- Indices apenas onde existem queries reais.
- Evitar views/materializacoes sem necessidade.
- Manter historico com politica de retencao configuravel.

### 13.4 Redis

- `maxmemory` definido conforme RAM do Pi.
- Politica `allkeys-lru` ou `volatile-lru` se cache tiver TTL.
- TTL em todas as chaves de cache.

## 14. Configuracao e constantes

### 14.1 `.env.example`

Deve conter todos os parametros configuraveis:

```env
APP_ENV=production
APP_NAME=GCO
APP_TIMEZONE=America/Sao_Paulo
API_PREFIX=/api

DATABASE_URL=postgresql+psycopg://gco:gco@postgres:5432/gco
REDIS_URL=redis://redis:6379/0

SECRET_KEY=change-me
ACCESS_TOKEN_EXPIRE_MINUTES=480

CORS_ORIGINS=http://localhost,http://127.0.0.1
WS_HEARTBEAT_SECONDS=30
PANEL_MAX_VISIBLE_CALLS=5
PANEL_CALL_DISPLAY_SECONDS=60
```

### 14.2 Constantes

Constantes ficam perto do dominio:

- `modules/calls/constants.py`.
- `modules/panel/constants.py`.
- `core/constants.py` apenas para valores realmente globais.

Evitar modulo gigante de constantes sem contexto.

## 15. Seguranca

Regras minimas:

- Senhas com Argon2 ou bcrypt bem configurado.
- `SECRET_KEY` obrigatoria em producao.
- Docs desativadas em producao ou protegidas.
- CORS restrito.
- Cookies HttpOnly se a autenticacao migrar para cookie.
- Rate limit em login.
- Auditoria para acoes administrativas.
- Usuario admin inicial criado por comando explicito.

## 16. Observabilidade

Logs:

- Estruturados.
- Sem dados sensiveis.
- Com `request_id`.
- Com eventos de dominio: `CALL_CREATED`, `CALL_FINISHED`, `WS_CONNECTED`.

Health:

- `/api/health`: processo vivo.
- `/api/health/ready`: banco e Redis acessiveis.

Metricas futuras:

- Chamadas por dia.
- Tempo medio ate atendimento.
- Falhas de WebSocket.
- Reconexoes do painel.

## 17. Testes

### 17.1 Backend

Camadas:

- Unitarios para services e regras de dominio.
- Integracao para repositorios com PostgreSQL real via Docker.
- API tests com `TestClient` ou `httpx.AsyncClient`.
- WebSocket tests para eventos do painel.

Casos obrigatorios:

- Criar chamada valida.
- Bloquear chamada medica antes de triagem quando regra exigir.
- Rechamar paciente.
- Finalizar atendimento.
- Cancelar chamada.
- Painel recebe evento via WebSocket.
- Usuario sem permissao recebe `403`.
- Redis indisponivel nao derruba operacao principal quando banco puder registrar chamada.

### 17.2 Frontend

- Typecheck.
- Lint.
- Testes de componentes criticos.
- Teste e2e do fluxo: login, chamar paciente, painel recebe chamada.

## 18. Roteiro de execucao

### Fase 0: Decisoes finais

- Escolher idioma dos nomes internos: portugues ou ingles.
- Decidir se agenda sera modulo interno ou adaptador externo.
- Decidir build do Next: estatico ou standalone.
- Definir Raspberry Pi alvo: Pi 3, Pi 4 ou Pi 5; arquitetura 32 ou 64 bits.

### Fase 1: Fundacao

- Criar nova raiz `backend/`, `frontend/`, `infra/`, `docs/`.
- Criar `pyproject.toml` com Ruff, pytest e dependencias.
- Criar FastAPI minimo com healthcheck.
- Criar Next.js minimo com rotas principais.
- Criar Docker Compose unico.
- Criar Nginx gateway com `/`, `/api`, `/ws`.

### Fase 2: Banco e configuracao

- Criar metadata com naming convention.
- Criar models V2.
- Criar migracao inicial limpa.
- Criar settings com Pydantic.
- Remover criacao automatica de tabela no startup.
- Criar comando administrativo para usuario inicial.

### Fase 3: Chamadas

- Implementar modulo `calls`.
- Implementar modulo `rooms`.
- Implementar modulo `appointments`.
- Implementar modulo `triage`.
- Implementar WebSocket e broadcast via Redis.
- Implementar cache curto para painel.

### Fase 4: Frontend

- Migrar telas para Next.js:
  - painel;
  - login;
  - operador/medico;
  - triagem;
  - admin.
- Encapsular API client.
- Encapsular WebSocket.
- Encapsular audio.
- Criar UX de reconexao.

### Fase 5: Hardening

- Testes unitarios e integracao.
- Healthchecks.
- Logs estruturados.
- Ajustes de performance para Raspberry Pi.
- Revisao de seguranca.
- Documentacao de deploy.

### Fase 6: Corte V2

- Congelar schema inicial V2.
- Gerar `.env.example`.
- Criar seed opcional sem secrets.
- Documentar comandos.
- Validar em ambiente limpo.
- Validar em Raspberry Pi.

## 19. Criterios de aceite

A V2 so deve ser considerada pronta quando:

- `docker compose up` sobe o produto inteiro em ambiente limpo.
- A porta publica unica abre o frontend.
- `/api/health/ready` valida PostgreSQL e Redis.
- O painel recebe chamadas em tempo real.
- O sistema continua funcional apos refresh do painel.
- Nao existem senhas, salas, limites e URLs chumbadas no codigo.
- Ruff passa sem erros.
- TypeScript passa em modo estrito.
- Testes criticos passam.
- O consumo em Raspberry Pi fica dentro do limite definido na Fase 0.

## 20. Principios que devem guiar a refatoracao

- Simplicidade primeiro.
- Codigo explicito.
- Uma regra de negocio em um lugar.
- Endpoints finos.
- Services pequenos.
- Repositorios previsiveis.
- Configuracao fora do codigo.
- Banco como fonte da verdade.
- Redis como acelerador e barramento volatil.
- Frontend sem regra de negocio sensivel.
- Docker reproduzivel.
- Nenhum legado estrutural obrigatorio.
