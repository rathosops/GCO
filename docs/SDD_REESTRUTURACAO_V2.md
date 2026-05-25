# SDD: Reestruturacao V2 do GCO

Data: 2026-05-25
Status: Proposto
Documento base: `docs/REFATORACAO_MONOLITO_MODULAR_V2.md`

## 1. Proposito

Este Software Design Document define como executar a reestruturacao do projeto GCO para uma versao 2.0 baseada em monolito modular, com backend FastAPI em Python 3.14 e frontend Next.js com TypeScript.

O objetivo deste SDD e servir como contrato tecnico para uma proxima rodada de implementacao assistida por IA. A IA deve seguir este documento antes de criar, mover, apagar ou refatorar codigo.

## 2. Fontes e metodologia

Este SDD combina:

- Levantamento local do repositorio atual.
- Plano arquitetural em `docs/REFATORACAO_MONOLITO_MODULAR_V2.md`.
- Praticas de Software Design Document inspiradas em modelos IEEE/SDD.
- Spec-Driven Development para IA, com fluxo `Spec -> Plan -> Tasks -> Implement`.
- Boas praticas de prompts para IA: instrucoes claras, contexto especifico, restricoes explicitas e criterios de aceite verificaveis.

Referencias consultadas:

- GitHub Spec Kit, metodologia SDD para IA: https://github.github.com/spec-kit/
- GitHub Spec Kit workflows: https://github.github.com/spec-kit/reference/workflows.html
- Kiro Specs, fluxo `requirements.md`, `design.md`, `tasks.md`: https://kiro.dev/docs/specs/
- OpenAI, prompt engineering best practices: https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-openai-api
- Atlassian, software design document best practices: https://www.atlassian.com/work-management/knowledge-sharing/documentation/software-design-document
- FastAPI bigger applications: https://fastapi.tiangolo.com/tutorial/bigger-applications/
- FastAPI settings: https://fastapi.tiangolo.com/advanced/settings/
- FastAPI SQL databases: https://fastapi.tiangolo.com/tutorial/sql-databases/
- Next.js App Router: https://nextjs.org/docs/app
- Ruff configuration: https://docs.astral.sh/ruff/configuration/
- PostgreSQL constraints e indexes: https://www.postgresql.org/docs/current/ddl-constraints.html

## 3. Escopo

### 3.1 Dentro do escopo

- Criar uma nova estrutura V2 no repositorio.
- Consolidar backend e frontend do sistema de chamadas em uma entrega unica.
- Migrar backend para FastAPI organizado por modulos de dominio.
- Migrar frontend para Next.js com TypeScript.
- Criar stack Docker unificada com Nginx, FastAPI, Next.js, PostgreSQL e Redis.
- Definir schema PostgreSQL V2 limpo.
- Remover valores chumbados do codigo.
- Criar configuracao centralizada.
- Criar padroes de lint, formatacao e testes.
- Preparar o sistema para rodar em Raspberry Pi.

### 3.2 Fora do escopo nesta etapa

- Garantir compatibilidade de banco com schemas antigos.
- Migrar dados reais de producao.
- Preservar APIs antigas.
- Manter Flask como runtime de negocio.
- Manter Vite como frontend alvo.
- Criar funcionalidades clinicas ou financeiras que nao sejam necessarias para o sistema de chamadas.

## 4. Principios de execucao por IA

Toda rodada futura de implementacao deve seguir estes principios:

1. Ler este SDD antes de editar codigo.
2. Ler `docs/REFATORACAO_MONOLITO_MODULAR_V2.md` antes de tomar decisoes arquiteturais.
3. Inspecionar a arvore atual do repositorio antes de criar arquivos.
4. Fazer mudancas em fatias pequenas e verificaveis.
5. Atualizar este SDD quando uma decisao real divergir do plano.
6. Nao preservar legado por inercia.
7. Nao apagar codigo antigo ate a nova estrutura estar minimamente funcional ou ate haver uma tarefa explicita de corte.
8. Nao introduzir dependencia nova sem registrar motivo.
9. Nao deixar segredo, senha, URL, porta, sala, limite ou texto operacional chumbado.
10. Validar cada fase com comandos objetivos.

## 5. Glossario

- GCO: produto resultante da V2.
- V2: nova versao limpa, sem compromisso com compatibilidade estrutural.
- Monolito modular: uma aplicacao entregue como produto unico, mas organizada internamente por modulos coesos.
- API: backend FastAPI.
- Web: frontend Next.js.
- Gateway: Nginx, porta publica unica.
- Painel: tela de televisao usada na recepcao.
- Chamada: evento de chamar paciente para sala, triagem ou atendimento.
- Operador: usuario autenticado que realiza chamadas.

## 6. Estado atual resumido

O repositorio contem:

- `CMI-PCG-SERVER`: backend principal atual, com Flask, SQLAlchemy, templates e muitos dominios.
- `CMI-PCG-FRONTEND`: frontend atual em Vite/React/TypeScript.
- `CMI-CHAMADAS-SYSTEM`: sistema de chamadas separado, ja com FastAPI, React/Vite, PostgreSQL, Redis e Docker.

Para a V2, o subsistema `CMI-CHAMADAS-SYSTEM` deve ser tratado como fonte de regras de negocio e prototipo funcional, nao como estrutura definitiva.

## 7. Arquitetura alvo

```text
Cliente / TV / Operador
        |
        v
      Nginx
   /    |     \
  /     |      \
Web   /api    /ws
Next  FastAPI FastAPI WebSocket
        |
        +--> PostgreSQL
        |
        +--> Redis
```

### 7.1 Componentes

`gateway`

- Nginx.
- Porta unica do produto.
- Serve frontend ou repassa para Next standalone.
- Repassa `/api` e `/ws` para FastAPI.

`api`

- FastAPI.
- Regras de negocio.
- WebSocket.
- Autenticacao.
- Persistencia.
- Eventos.

`web`

- Next.js.
- UI do painel, login, operador, triagem e admin.
- Sem regra de negocio sensivel.

`postgres`

- Fonte de verdade.
- Schema V2 limpo.
- Migrations via Alembic.

`redis`

- Cache curto.
- Pub/Sub.
- Estado volatil de conexoes/eventos.

## 8. Decisoes tecnicas

### D001: Criar estrutura V2 paralela

Criar novas pastas `backend/`, `frontend/`, `infra/` e `docs/` na raiz atual. Manter os projetos antigos inicialmente para consulta.

Motivo:

- Reduz risco de quebrar referencias enquanto a V2 nasce.
- Permite comparar regras atuais com a nova implementacao.
- Evita uma migracao incremental artificial em projeto ainda em desenvolvimento.

### D002: Backend por modulos de dominio

Usar estrutura modular:

```text
backend/app/
├── api/
├── core/
├── modules/
│   ├── auth/
│   ├── calls/
│   ├── rooms/
│   ├── appointments/
│   ├── triage/
│   ├── panel/
│   └── audit/
└── shared/
```

Motivo:

- Evita camadas globais enormes.
- Melhora localidade de regras.
- Facilita execucao por IA em fatias menores.

### D003: API versionada

Toda rota HTTP deve ficar abaixo de `/api/v1`.

Excecoes:

- `/api/health`.
- `/api/health/ready`.
- `/ws`.

### D004: Banco limpo

Criar schema V2 com Alembic desde o inicio. Nao usar `Base.metadata.create_all()` no startup.

Motivo:

- Runtime nao deve alterar schema implicitamente.
- Migrations devem ser auditaveis.
- O projeto nao precisa preservar legado.

### D005: Configuracao centralizada

Usar Pydantic Settings em `backend/app/core/config.py`.

Motivo:

- Tipagem.
- Validacao.
- Menos valores chumbados.
- Compatibilidade com Docker e ambientes diferentes.

### D006: Frontend Next.js com App Router

Usar Next.js App Router e TypeScript estrito.

Motivo:

- Meta definida para V2.
- Estrutura moderna e documentada.
- Possibilidade de build estatico ou standalone.

### D007: Otimizacao para Raspberry Pi

Toda decisao deve considerar:

- Imagens pequenas.
- Poucos workers.
- Pool pequeno de banco.
- Cache com TTL.
- Menos dependencias.
- Frontend estatico quando viavel.

## 9. Requisitos funcionais

### RF001: Painel publico

O sistema deve disponibilizar uma tela publica de painel para TV.

Aceite:

- Dado que uma chamada e criada, quando o painel esta conectado, entao ele recebe a chamada em tempo real.
- Dado que a conexao cai, quando a rede volta, entao o painel reconecta sem recarregamento manual.
- Dado que o painel e aberto, entao ele mostra as ultimas chamadas ativas ou estado vazio.

### RF002: Autenticacao

O sistema deve autenticar usuarios operadores.

Aceite:

- Dado usuario e senha validos, quando o login ocorre, entao o usuario acessa sua area permitida.
- Dado um usuario inativo, quando tenta login, entao recebe erro controlado.
- Dado um usuario sem permissao, quando acessa rota restrita, entao recebe `403`.

### RF003: Chamadas

O sistema deve permitir criar, rechamar, iniciar, finalizar e cancelar chamadas.

Aceite:

- Dado um paciente elegivel, quando o operador cria chamada, entao a chamada e persistida e publicada.
- Dado uma chamada ativa, quando o operador finaliza, entao status e timestamps sao atualizados.
- Dado uma regra de triagem obrigatoria, quando medico tenta chamar antes da triagem, entao o sistema bloqueia com `409`.

### RF004: Salas

O sistema deve permitir configurar salas.

Aceite:

- Dado uma sala ativa, quando uma chamada e criada, entao ela pode ser associada a sala.
- Dado uma sala inativa, quando um operador tenta usa-la, entao o sistema bloqueia.

### RF005: Triagem

O sistema deve controlar fluxo de triagem quando exigido.

Aceite:

- Dado paciente que exige triagem, quando triagem e concluida, entao ele fica elegivel para chamada medica.
- Dado paciente sem triagem obrigatoria, entao ele pode seguir direto para chamada permitida.

### RF006: Configuracoes operacionais

O sistema deve permitir configurar valores operacionais sem alterar codigo.

Aceite:

- Limite de chamadas do painel vem de configuracao.
- Tempo de exibicao vem de configuracao.
- Salas iniciais podem ser criadas por seed/comando, nao pelo startup.

## 10. Requisitos nao funcionais

### RNF001: Performance

O sistema deve rodar em Raspberry Pi como alvo operacional.

Aceite:

- API sobe com 1 worker em producao local.
- Pool padrao de banco nao excede 3 conexoes base.
- Painel nao depende de polling agressivo.

### RNF002: Legibilidade

O codigo deve ser simples, tipado e autoexplicativo.

Aceite:

- Ruff passa.
- Funcoes publicas criticas tem type hints.
- Services nao dependem diretamente de objetos HTTP.

### RNF003: Confiabilidade

Chamadas nao podem depender apenas de Redis.

Aceite:

- Chamada criada e gravada no PostgreSQL antes ou junto da publicacao de evento.
- Falha temporaria no Redis nao apaga historico.

### RNF004: Segurança

O sistema nao deve conter segredos no codigo.

Aceite:

- `SECRET_KEY` e obrigatoria em producao.
- Usuario admin inicial e criado por comando.
- Senhas padrao nao existem em arquivos versionados, exceto placeholders em `.env.example`.

### RNF005: Observabilidade

O sistema deve expor saude e logs uteis.

Aceite:

- `/api/health` responde sem depender de banco.
- `/api/health/ready` valida PostgreSQL e Redis.
- Logs de chamadas incluem acao, usuario e id da chamada.

## 11. Design backend

### 11.1 `main.py`

Responsabilidade:

- Criar app.
- Registrar lifespan.
- Registrar middlewares.
- Registrar handlers.
- Incluir routers.

Proibido:

- Criar tabelas.
- Criar usuarios.
- Conter regra de negocio.
- Ler arquivos arbitrarios de configuracao.

### 11.2 `core`

Arquivos esperados:

- `config.py`: settings Pydantic.
- `database.py`: engine, sessionmaker, dependency.
- `redis.py`: cliente Redis e health.
- `security.py`: hashing, token, helpers.
- `logging.py`: configuracao de logs.
- `lifespan.py`: inicializacao/encerramento.
- `constants.py`: constantes globais raras.

### 11.3 `modules`

Cada modulo deve seguir este padrao quando aplicavel:

```text
models.py
schemas.py
repository.py
service.py
exceptions.py
constants.py
```

Regra:

- `repository.py` fala com SQLAlchemy.
- `service.py` contem regras de negocio.
- `schemas.py` define contratos de entrada/saida.
- `models.py` define persistencia.
- `api/v1/*.py` chama services e traduz erros.

### 11.4 Tratamento de erros

Criar excecoes de dominio e traduzi-las em handlers.

Mapeamento:

- `NotFoundError` -> `404`.
- `PermissionDeniedError` -> `403`.
- `BusinessRuleError` -> `409`.
- `AuthenticationError` -> `401`.

### 11.5 WebSocket

Design:

- Endpoint `/ws/panel`.
- Manager local para conexoes do processo.
- Redis Pub/Sub para distribuir eventos entre workers, se mais de um processo existir.
- Heartbeat configuravel.
- Evento JSON versionado.

Envelope:

```json
{
  "version": 1,
  "type": "call.created",
  "occurred_at": "2026-05-25T10:00:00-03:00",
  "payload": {}
}
```

## 12. Design frontend

### 12.1 Rotas

```text
/login
/painel
/operador
/triagem
/admin
```

### 12.2 Organizacao

```text
frontend/src/
├── app/
├── components/
├── features/
│   ├── auth/
│   ├── calls/
│   ├── panel/
│   ├── rooms/
│   └── triage/
├── lib/
└── types/
```

### 12.3 API client

Regras:

- Usar URL relativa por padrao: `/api`.
- Encapsular fetch em `lib/api.ts`.
- Tratar `401`, `403`, `409` de forma consistente.
- Nao espalhar endpoints em componentes.

### 12.4 Painel

Regras:

- Componentes grandes e legiveis para TV.
- WebSocket encapsulado.
- Audio encapsulado.
- Fallback quando som estiver bloqueado.
- Sem textos explicativos desnecessarios na interface.
- Indicador discreto de conexao.

## 13. Design de dados

Tabelas iniciais:

- `users`
- `rooms`
- `appointments`
- `calls`
- `triage_records`
- `panel_settings`
- `audit_logs`

As definicoes detalhadas estao em `docs/REFATORACAO_MONOLITO_MODULAR_V2.md`.

Regras:

- `snake_case`.
- Sem nomes com aspas.
- `timestamptz`.
- `numeric` para dinheiro, se surgir.
- Texto para documentos e telefones.
- Naming convention no SQLAlchemy/Alembic.

## 14. Contratos de API iniciais

### 14.1 Health

`GET /api/health`

Resposta:

```json
{
  "status": "ok",
  "service": "gco",
  "version": "2.0.0"
}
```

`GET /api/health/ready`

Resposta:

```json
{
  "status": "ready",
  "postgres": "ok",
  "redis": "ok"
}
```

### 14.2 Auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

### 14.3 Calls

- `GET /api/v1/calls`
- `POST /api/v1/calls`
- `POST /api/v1/calls/{call_id}/recall`
- `POST /api/v1/calls/{call_id}/start`
- `POST /api/v1/calls/{call_id}/finish`
- `POST /api/v1/calls/{call_id}/cancel`

### 14.4 Panel

- `GET /api/v1/panel/state`
- `GET /api/v1/panel/settings`
- `PUT /api/v1/panel/settings`

### 14.5 Rooms

- `GET /api/v1/rooms`
- `POST /api/v1/rooms`
- `PATCH /api/v1/rooms/{room_id}`

## 15. Estrategia de migracao

Esta reestruturacao nao e uma migracao incremental de compatibilidade. E uma criacao de V2.

Ordem:

1. Criar estrutura V2 paralela.
2. Criar stack minima com healthchecks.
3. Criar schema limpo.
4. Reimplementar fluxo de chamadas.
5. Reimplementar frontend.
6. Validar em ambiente limpo.
7. Comparar regras uteis com `CMI-CHAMADAS-SYSTEM`.
8. Cortar dependencias antigas quando V2 estiver funcional.

## 16. Plano de execucao em fases

### Fase A: Bootstrap

Objetivo: criar esqueleto executavel.

Status: concluida em 2026-05-25.

Tarefas:

- `T001`: Concluida. Criado `backend/pyproject.toml` com Python 3.14, FastAPI, SQLAlchemy, Alembic, Ruff e pytest.
- `T002`: Concluida. Criado `backend/app/main.py` com healthcheck simples.
- `T003`: Concluida. Criado `backend/app/core/config.py`.
- `T004`: Concluida. Criado `frontend/` com Next.js TypeScript.
- `T005`: Concluida. Criado `infra/nginx/nginx.conf`.
- `T006`: Concluida. Criado `docker-compose.yml`.
- `T007`: Concluida. Criado `.env.example`.

Aceite:

- Concluido: `docker compose config` passa.
- Concluido: arquivos Python principais compilam com `python -m py_compile`.
- Concluido: stack sobe com `docker compose up --build -d`.
- Concluido: containers `api`, `web`, `gateway`, `postgres` e `redis` ficam saudaveis.
- Concluido: API responde `/api/health` dentro da rede Docker.
- Concluido: frontend responde `200 OK` dentro da rede Docker.
- Observacao: a porta do gateway esta publicada em `8080:80`, mas o `curl` do sandbox local para `127.0.0.1:8080` falhou mesmo com o Docker reportando a porta publicada. Validar no navegador/host real em `http://localhost:8080`.

### Fase B: Banco

Objetivo: criar persistencia V2.

Status: concluida em 2026-05-25.

Tarefas:

- `T101`: Concluida. Configurado SQLAlchemy 2.x em `backend/app/core/database.py`.
- `T102`: Concluida. Configurado Alembic em `backend/alembic.ini` e `backend/alembic/`.
- `T103`: Concluida. Criados models iniciais para `users`, `rooms`, `appointments`, `calls`, `triage_records`, `panel_settings` e `audit_logs`.
- `T104`: Concluida. Criada e aplicada migracao inicial `20260525_0001_initial_schema.py`.
- `T105`: Concluida. Criado repository base e repositories simples por modulo.
- `T106`: Concluida. Criado `/api/health/ready` validando PostgreSQL e Redis.

Aceite:

- Concluido: Alembic aplica em banco vazio com `alembic upgrade head`.
- Concluido: `/api/health/ready` retorna `{"status":"ready","postgres":"ok","redis":"ok"}`.
- Concluido: nenhuma tabela e criada no startup.
- Concluido: `alembic check` nao detecta operacoes pendentes entre models e schema.
- Concluido: tabelas publicas criadas: `alembic_version`, `appointments`, `audit_logs`, `calls`, `panel_settings`, `rooms`, `triage_records`, `users`.

### Fase C: Auth

Objetivo: autenticar operadores.

Status: concluida em 2026-05-25.

Tarefas:

- `T201`: Concluida. Criado modulo `auth` com schemas, service, exceptions e repository.
- `T202`: Concluida. Implementado hash de senha com `pwdlib[argon2]`.
- `T203`: Concluida. Implementado `POST /api/v1/auth/login` com JWT Bearer.
- `T204`: Concluida. Implementado `GET /api/v1/auth/me`.
- `T205`: Concluida. Criado comando explicito `python -m app.commands.create_admin`, exigindo `GCO_ADMIN_PASSWORD`.
- `T206`: Concluida. Criadas dependencias `get_current_user` e `require_roles`; `/me` e `/logout` exigem token.

Aceite:

- Concluido: login valido retorna token.
- Concluido: usuario inativo nao entra e recebe `403`.
- Concluido: rota protegida sem token retorna `401`.
- Concluido: `/api/v1/auth/me` retorna o usuario autenticado com token valido.
- Concluido: `/api/v1/auth/logout` exige token e retorna `204` com token valido.

### Fase D: Chamadas

Objetivo: reimplementar fluxo central.

Status: concluida em 2026-05-25.

Tarefas:

- `T301`: Concluida. Implementados schemas, service, repository e rotas de `rooms`.
- `T302`: Concluida. Implementados schemas, service, repository e rotas de `appointments`.
- `T303`: Concluida. Implementados schemas, service, repository e rota de conclusao de `triage`.
- `T304`: Concluida. Implementados schemas, service, repository e rotas de `calls`.
- `T305`: Concluida. Implementadas regras de elegibilidade, incluindo bloqueio de chamada medica antes da triagem obrigatoria.
- `T306`: Concluida. Implementados status e timestamps para criar, iniciar, finalizar e cancelar chamadas.
- `T307`: Concluida. Implementado audit log basico para criacao de sala, agendamento, triagem e transicoes de chamadas.

Aceite:

- Concluido: criar chamada persiste no banco.
- Concluido: triagem obrigatoria bloqueia chamada medica indevida com `409`.
- Concluido: finalizacao atualiza status de chamada e agendamento para `completed`.
- Concluido: rotas de dominio exigem token e roles permitidas.
- Concluido: `alembic check` nao detecta alteracoes pendentes.

### Fase E: Tempo real

Objetivo: painel receber eventos.

Status: concluida em 2026-05-25.

Tarefas:

- `T401`: Concluida. Criado WebSocket publico `/ws/panel`.
- `T402`: Concluida. Criado envelope versionado `PanelEvent`.
- `T403`: Concluida. Criado publisher Redis no canal `gco:panel:events`.
- `T404`: Concluida. Criado broadcaster local e subscriber Redis de background.
- `T405`: Concluida. Criado endpoint `GET /api/v1/panel/state`.

Aceite:

- Concluido: painel conectado recebe `call.created`.
- Concluido: reconexao recupera estado via HTTP em `/api/v1/panel/state`.
- Concluido: persistencia da chamada ocorre antes do publish; falha de Redis nao remove chamada persistida.
- Concluido: `alembic check` nao detecta alteracoes pendentes.
- Observacao: para evitar perda de evento no proprio processo e suportar multiplos processos, a rota faz broadcast local e tambem publica no Redis com `_source_id`; o subscriber ignora eventos originados pelo proprio processo e repassa eventos de outros processos.

### Fase F: Frontend

Objetivo: substituir Vite/React por Next.js.

Status: concluida em 2026-05-25.

Tarefas:

- `T501`: Concluida. Criado layout base operacional com rotas para painel, operador, triagem, admin e login.
- `T502`: Concluida. Criado login client-side contra `POST /api/v1/auth/login` e validacao com `/api/v1/auth/me`.
- `T503`: Concluida. Criado painel publico com estado inicial via HTTP, WebSocket `/ws/panel`, reconexao simples e som encapsulado.
- `T504`: Concluida. Criada tela de operador para cadastrar paciente, selecionar sala/tipo, criar chamada e mudar status de chamadas ativas.
- `T505`: Concluida. Criada tela de triagem para listar pacientes elegiveis e concluir triagem.
- `T506`: Concluida. Criada tela admin minima para listar e criar salas.
- `T507`: Concluida. Criados `frontend/src/lib/api.ts`, `auth.ts`, `ws.ts`, `sound.ts` e tipos compartilhados em `frontend/src/types/api.ts`.

Aceite:

- Concluido: build Next.js passa com checagem de TypeScript.
- Concluido: login usa API real e armazena sessao no navegador sem senha persistida.
- Concluido: operador usa endpoints reais de agendamentos, salas e chamadas.
- Concluido: painel carrega `/api/v1/panel/state` e assina `/ws/panel`.
- Concluido: stack Docker recompilada e containers `api`, `web`, `gateway`, `postgres` e `redis` ficaram saudaveis.
- Observacao: validacao visual ainda deve ser feita em navegador real em `http://localhost:8080`, pois o sandbox nao executa interacao de browser.

### Fase G: Hardening

Objetivo: preparar entrega.

Status: concluida em 2026-05-25.

Tarefas:

- `T601`: Concluida. Ajustados Dockerfiles multi-stage para backend e frontend; adicionados `.dockerignore` locais para reduzir contexto de build.
- `T602`: Concluida. API, web e gateway rodam como usuario nao-root; gateway passou a usar imagem `nginxinc/nginx-unprivileged`.
- `T603`: Concluida. Mantidos pool pequeno de PostgreSQL e `API_WORKERS=1`; Redis recebeu limite configuravel de memoria.
- `T604`: Concluida. Criada configuracao central de logs da API com `request_id` e logs no stdout dos containers com rotacao.
- `T605`: Concluida. Criados testes criticos para segredo em producao, JWT e bloqueio de chamada medica antes da triagem.
- `T606`: Concluida. Criado `docs/DEPLOY_V2.md` com comandos de deploy, migration, admin inicial e validacao.
- `T607`: Concluida. Revisada seguranca minima: `SECRET_KEY` obrigatoria em producao, headers defensivos no gateway, `no-new-privileges` e CORS por ambiente.

Aceite:

- Concluido: Ruff passa.
- Concluido: TypeScript passa.
- Concluido: testes criticos passam.
- Concluido: stack sobe em ambiente limpo com containers saudaveis.
- Observacao: `npm install` e build Docker reportaram 2 vulnerabilidades moderadas em dependencias transitivas do frontend; nao foi aplicado `npm audit fix --force` porque pode introduzir breaking changes. Revisar em rodada propria de atualizacao de dependencias.

## 17. Ordem recomendada para IA

Em uma rodada futura, a IA deve executar apenas uma fase por vez, salvo autorizacao explicita.

Para a expansao do GCO alem do sistema de chamadas, use tambem:

- `docs/SDD_MIGRACAO_SUPERSERVIDOR_GCO.md`
- `docs/ARQUITETURA_GCO_SUPERSERVIDOR.md`
- `docs/MAPA_MODULOS_GCO.md`
- `docs/GUIA_IA_MIGRACAO_GCO.md`

Formato recomendado de pedido:

```text
Siga docs/SDD_REESTRUTURACAO_V2.md.
Execute a Fase A inteira.
Nao implemente fases posteriores.
Ao terminar, rode as verificacoes da fase e atualize o SDD se algo mudar.
```

Para tarefas individuais:

```text
Siga docs/SDD_REESTRUTURACAO_V2.md.
Execute apenas T301 e T302.
Nao altere frontend.
Valide com testes ou explique por que nao foi possivel.
```

## 18. Politica de atualizacao do SDD

Este documento e vivo. Atualizar quando:

- Uma decisao arquitetural mudar.
- Uma dependencia for adicionada ou removida.
- Um endpoint mudar de contrato.
- Uma tabela mudar de forma relevante.
- Uma fase for concluida.
- Um criterio de aceite for ajustado.

Formato de alteracao:

- Atualizar a secao afetada.
- Adicionar entrada no changelog.
- Explicar o motivo tecnico, nao apenas o resultado.

## 19. Definition of Done por rodada

Uma rodada de implementacao so esta completa quando:

- Mudancas foram feitas dentro do escopo da fase/tarefa.
- O codigo relevante foi formatado.
- Lint/testes aplicaveis foram executados ou a impossibilidade foi registrada.
- Nenhum segredo foi introduzido.
- O SDD foi atualizado se houve divergencia.
- A resposta final lista arquivos principais alterados e comandos de validacao.

## 20. Riscos

### R001: Python 3.14 e dependencias ARM

Risco:

- Alguma dependencia pode nao ter wheel pronta para Python 3.14 em ARM.

Mitigacao:

- Validar cedo no Docker.
- Registrar ADR se for necessario usar Python 3.13 temporariamente.

### R002: Excesso de arquitetura

Risco:

- Modularizacao exagerada pode dificultar um sistema pequeno.

Mitigacao:

- Criar modulos apenas onde existe dominio real.
- Evitar abstrair antes de haver regra concreta.

### R003: Specs desatualizadas

Risco:

- Uma IA futura seguir documento antigo e implementar algo incorreto.

Mitigacao:

- SDD vivo.
- Atualizacao obrigatoria quando implementacao divergir.
- Criticas por fase antes de implementar.

### R004: Redis tratado como fonte de verdade

Risco:

- Perda de historico ou inconsistencias em falha de Redis.

Mitigacao:

- PostgreSQL sempre persiste chamada.
- Redis apenas cache/pubsub.

### R005: Frontend pesado para Raspberry Pi

Risco:

- Next standalone consumir mais recursos que o necessario.

Mitigacao:

- Avaliar build estatico.
- Evitar SSR quando nao agregar valor.
- Medir consumo real.

## 21. Changelog

### 2026-05-25

- Criado SDD inicial para orientar a reestruturacao V2.
- Definido fluxo de execucao por fases.
- Definidos requisitos, decisoes tecnicas, contratos iniciais e criterios de aceite.
- Executada a Fase A: criados scaffolds de `backend/`, `frontend/`, `infra/`, `docker-compose.yml`, `.env.example` e `.dockerignore`.
- Validado `docker compose config`, compilacao Python dos arquivos iniciais, build Docker do backend/frontend e saude dos containers.
- Ajustados healthchecks Docker para usar `127.0.0.1`, evitando falha por resolucao IPv6 de `localhost` em containers.
- Registrado risco operacional: comandos `git status` e `git rev-parse` falham na raiz apesar de existir `.git`; auditar o estado do repositorio antes de commits.
- Executada a Fase B: configurados SQLAlchemy 2.x, Alembic, migration inicial, models de dominio, repositories base e `/api/health/ready`.
- Aplicada migration inicial no PostgreSQL da V2 e validado `alembic current` em `20260525_0001 (head)`.
- Validado `alembic check` sem operacoes pendentes.
- Executada a Fase C: implementados hash Argon2, JWT Bearer, login, `me`, logout protegido, dependencias de autenticacao/autorizacao e comando explicito para admin inicial.
- Validado usuario admin `phasec_admin` no banco de desenvolvimento da V2 por comando sem senha padrao no codigo.
- Validado usuario inativo retornando `403`, rotas protegidas sem token retornando `401`, login valido retornando `200`, `me` retornando `200` e logout retornando `204`.
- Executada a Fase D: implementado fluxo central de salas, agendamentos, triagem e chamadas, sem WebSocket/tempo real.
- Validado fluxo via API: sala criada, agendamento com triagem obrigatoria criado, chamada medica bloqueada antes da triagem, triagem concluida, chamada criada, iniciada e finalizada.
- Validado audit log basico com eventos `room.created`, `appointment.created`, `triage.completed`, `call.created`, `call.started` e `call.finished`.
- Executada a Fase E: implementados WebSocket `/ws/panel`, envelope `PanelEvent`, Redis Pub/Sub, broadcaster local e endpoint `/api/v1/panel/state`.
- Validado tempo real de ponta a ponta: cliente WebSocket conectado recebeu evento `call.created` apos criacao de chamada via API.
- Validado fallback HTTP do painel: `/api/v1/panel/state` retorna chamadas ativas e recentes.
- Executada a Fase F: implementadas telas Next.js para home, login, painel, operador, triagem e admin minimo.
- Criada camada frontend tipada para API, sessao, WebSocket e audio, mantendo endpoints concentrados em `frontend/src/lib/api.ts`.
- Validado `docker compose up --build -d web gateway`: build Next.js concluiu com checagem de tipos e a stack voltou saudavel.
- Validado gateway interno servindo `/operador` e proxy `/api/health` retornando status `ok`.
- Validado login via gateway interno em `/api/v1/auth/login` com usuario administrativo de desenvolvimento.
- Criada base de governanca do repositorio antes da Fase G: `.gitignore`, `.gitattributes`, `README.md`, workflows de CI/CD, Dependabot, templates de issue/PR, `CODEOWNERS` placeholder e politica inicial de seguranca.
- Executada a Fase G: Dockerfiles multi-stage revisados, gateway nao-root, logs centralizados, limites para Raspberry Pi, testes criticos e documentacao de deploy.
- Validado `python -m ruff format --check .`, `python -m ruff check .`, `python -m pytest`, `npm run lint`, `npm run typecheck`, `npm run build`, `docker compose config`, `docker compose build api web`, `docker compose up -d`, `alembic upgrade head`, `alembic check`, `/api/health`, `/api/health/ready`, gateway `/health` e frontend via gateway em `/operador`.
- Registrada pendencia de seguranca: npm audit reporta 2 vulnerabilidades moderadas em dependencias transitivas do frontend; corrigir em rodada dedicada para evitar upgrade forcado com breaking changes.
- Criado SDD da migracao do superservidor GCO para planejar a incorporacao das funcionalidades de `CMI-PCG-SERVER` e `CMI-PCG-FRONTEND` em arquitetura FastAPI/Next.js white-label.
- Criados documentos auxiliares `ARQUITETURA_GCO_SUPERSERVIDOR.md`, `MAPA_MODULOS_GCO.md` e `GUIA_IA_MIGRACAO_GCO.md`.
