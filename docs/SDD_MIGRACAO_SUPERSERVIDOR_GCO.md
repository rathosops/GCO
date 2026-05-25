# SDD: Migracao do Superservidor GCO

Data: 2026-05-25
Status: Proposto
Documento relacionado: `docs/SDD_REESTRUTURACAO_V2.md`

## 1. Proposito

Este SDD define a proxima etapa da V2: migrar as funcionalidades principais de
`CMI-PCG-SERVER` e `CMI-PCG-FRONTEND` para o novo GCO, sem preservar a
arquitetura Flask/MVC nem a SPA Vite como alvo.

O GCO deve deixar de ser apenas um sistema de chamadas e se tornar uma
plataforma white-label para clinicas ocupacionais brasileiras, cobrindo:

- administracao e perfilamento;
- pacientes, profissionais, empresas, convenios e fornecedores;
- agendamento, fila, chamadas em painel de TV, triagem e consultas;
- prontuario, receituarios, solicitacoes de exames e ASO;
- documentos, PDFs, relatorios, financeiro e faturamento;
- farmacia, estoque e rastreabilidade;
- auditoria e integracoes brasileiras.

## 2. Principios obrigatorios

- FastAPI com endpoints finos e regras fora dos routers.
- Python 3.14, type hints, Ruff, PEP 8, PEP 257 e docstrings em portugues do
  Brasil.
- Codigo simples, explicito, DRY, KISS e aderente ao Zen do Python.
- POO somente onde houver estado, polimorfismo ou contrato claro.
- SQLAlchemy 2.x, Alembic e PostgreSQL como fonte da verdade.
- Next.js App Router com TypeScript estrito.
- White-label por padrao: sem textos, logos, variaveis ou nomes ligados a CMI.
- Nenhum segredo, senha, logo, sala, empresa, URL ou regra operacional chumbada.
- Toda decisao que divergir deste SDD deve atualizar este documento.

## 3. Fontes analisadas

Backend legado:

- `CMI-PCG-SERVER/app/control/*`
- `CMI-PCG-SERVER/app/models/*`
- `CMI-PCG-SERVER/app/src/*`
- `CMI-PCG-SERVER/templates/*`
- `CMI-PCG-SERVER/app/blueprints.py`

Frontend legado:

- `CMI-PCG-FRONTEND/src/App.tsx`
- `CMI-PCG-FRONTEND/src/components/layout/DashboardLayout.tsx`
- `CMI-PCG-FRONTEND/src/services/*`
- `CMI-PCG-FRONTEND/src/features/*`

## 4. Decisoes arquiteturais

### D101: Nova versao sem compatibilidade estrutural

Nao migrar controllers Flask, blueprints, templates Jinja ou services como estao.
O legado e fonte de requisitos e regras, nao de estrutura.

### D102: Modulos por dominio

O backend deve crescer em `backend/app/modules`, com modulos coesos:

```text
identity
tenant
patients
professionals
companies
appointments
calls
clinical_records
occupational_health
exams
prescriptions
documents
finance
billing
inventory
reports
integrations
audit
```

### D103: Plataforma white-label

Criar um modulo `tenant` ou `organization` para perfil da clinica:

- nome comercial;
- razao social;
- CNPJ;
- endereco;
- telefones;
- e-mail;
- logo;
- tema visual;
- timezone;
- parametros fiscais e operacionais.

Todo PDF, tela e relatorio deve receber esse perfil por servico ou dependencia.
Nao usar defaults como "Centro Medico Integrado", "CMI" ou `logo_cmi.png`.

### D104: Documentos como dominio proprio

PDFs e arquivos devem ficar em `documents` e `reports`, nao dentro de
controllers de dominio.

Contratos esperados:

- `DocumentContextBuilder`: monta dados.
- `DocumentTemplate`: define template e metadados.
- `PdfRenderer`: renderiza HTML para PDF.
- `DocumentStorage`: salva artefatos quando necessario.
- `DocumentResponse`: adapta para resposta HTTP.

### D105: RBAC real

Substituir protecao por metodo HTTP do Flask por permissoes explicitas:

- `patients.read`, `patients.write`;
- `appointments.manage`;
- `clinical_records.read`, `clinical_records.write`;
- `finance.read`, `finance.write`;
- `tenant.manage`;
- `audit.read`;
- demais permissoes por modulo.

O frontend deve esconder menus e acoes sem permissao, mas a API e a autoridade.

### D106: Contratos uniformes

APIs novas devem usar envelopes previsiveis:

```json
{
  "data": {},
  "message": "Opcional",
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 100
  }
}
```

Arquivos podem retornar stream binario com headers corretos.

### D107: Dados brasileiros normalizados

- CPF e CNPJ: texto contendo somente digitos.
- Telefone, CEP, CRM, CBO, CNAE, CRESS e codigos fiscais: texto.
- Dinheiro: `numeric(12, 2)`/`Decimal`.
- Datas clinicas e fiscais: timezone-aware quando tiver hora; `date` quando for
  apenas data civil.

## 5. Escopo funcional alvo

### 5.1 Administracao

- usuarios;
- papeis;
- permissoes;
- perfil da clinica;
- parametros operacionais;
- auditoria;
- feature flags por instalacao.

### 5.2 Cadastros base

- pacientes;
- medicos;
- enfermeiros;
- atendentes;
- assistentes sociais;
- empresas;
- setores;
- cargos;
- convenios;
- fornecedores;
- procedimentos;
- exames.

### 5.3 Fluxo operacional

- agendamento;
- importacao CSV de agenda;
- chamada em painel de TV;
- triagem;
- consulta;
- prontuario;
- receituario;
- solicitacao de exames;
- comprovantes e documentos.

### 5.4 Saude ocupacional

- vinculo trabalhador-empresa;
- riscos por cargo;
- exames periodicos;
- ASO;
- questionario ocupacional;
- historico de 20 anos quando aplicavel;
- relatorios NR-7/PCMSO.

### 5.5 Financeiro

- pagamentos;
- despesas;
- DRE simples;
- analytics;
- relatorios por paciente, empresa, convenio, exames e outros;
- faturamento posterior por empresa;
- recibos e demonstrativos;
- reconciliacao de NFS-e por PDF.

### 5.6 Farmacia e estoque

- medicamentos;
- lotes;
- fornecedores;
- entrada;
- ajuste;
- descarte;
- dispensacao;
- rastreio por paciente, consulta e profissional;
- alertas de validade e estoque minimo.

### 5.7 Documentos, arquivos e relatorios

- ficha de paciente;
- prontuario;
- comprovante de agendamento;
- receituario;
- solicitacao de exames;
- ASO;
- questionario ASO;
- documento livre;
- relatorio financeiro;
- recibo/faturamento posterior;
- relatorios de farmacia;
- export CSV;
- upload de PDF NFS-e.

## 6. Fora do escopo imediato

- Compatibilidade de endpoints legados.
- Copia direta de templates Jinja.
- Multi-tenant SaaS complexo com isolamento por varias clinicas no mesmo banco.
  A V2 deve ser white-label e preparada para organizacao, mas a operacao inicial
  pode ser single-tenant configuravel.
- Migracao automatica de dados reais sem plano especifico.

## 7. Estrutura backend proposta

```text
backend/app/modules/
  tenant/
    models.py
    schemas.py
    repository.py
    service.py
    policies.py
  identity/
  patients/
  professionals/
  companies/
  appointments/
  calls/
  clinical_records/
  occupational_health/
  exams/
  prescriptions/
  documents/
  finance/
  billing/
  inventory/
  reports/
  integrations/
  audit/
```

Cada modulo deve ter somente os arquivos necessarios. Evitar criar classes
vazias ou camadas sem regra real.

## 8. Estrutura frontend proposta

```text
frontend/src/
  app/
    (auth)/login/page.tsx
    (dashboard)/layout.tsx
    (dashboard)/page.tsx
    (dashboard)/pacientes/page.tsx
    (dashboard)/agendamentos/page.tsx
    (dashboard)/consultas/page.tsx
    (dashboard)/empresas/page.tsx
    (dashboard)/financeiro/page.tsx
    (dashboard)/admin/page.tsx
    painel/page.tsx
  features/
    tenant/
    identity/
    patients/
    appointments/
    calls/
    clinical-records/
    occupational-health/
    finance/
    inventory/
    documents/
  lib/
    api.ts
    auth.ts
    files.ts
    permissions.ts
    tenant.ts
```

## 9. Fases de migracao

### Fase H: Especificacao do Superservidor

Objetivo: documentar arquitetura, modulos, contratos e ordem de migracao.

Tarefas:

- `T701`: mapear backend legado.
- `T702`: mapear frontend legado.
- `T703`: criar SDD desta migracao.
- `T704`: criar mapa de modulos e guias para IA.
- `T705`: atualizar README para o novo escopo.

Aceite:

- Documentos em `docs/` descrevem a nova arquitetura.
- README apresenta o GCO como plataforma completa white-label.
- Referencias CMI ficam apenas como legado analisado, nao como marca alvo.

### Fase I: Fundacao white-label e identidade

Objetivo: criar base administrativa para a plataforma completa.

Tarefas:

- `T801` [iniciado]: criar modulo `tenant` com perfil da clinica.
- `T802` [iniciado]: expandir `auth` para papeis e permissoes granulares.
- `T803` [iniciado]: criar shell administrativo Next.js com menu por permissoes.
- `T804` [iniciado]: remover branding CMI do frontend V2.
- `T805` [iniciado]: criar seeds/comandos explicitos para perfil inicial e admin.

Entregue em 2026-05-25:

- Criado `docs/BOAS_PRATICAS_GCO.md` com padroes de FastAPI, Python 3.14,
  POO, Docker, Nginx, TypeScript e Next.js.
- Criado modulo `tenant` com rota publica `GET /api/v1/tenant/profile` e rota
  administrativa `PUT /api/v1/tenant/profile`.
- Criada migration `20260525_0002` para `tenant_profiles`.
- Criado comando `python -m app.commands.upsert_tenant_profile` para configurar
  o perfil white-label sem valores de clinica especifica.
- Criada base de permissoes granulares calculadas a partir dos papeis atuais,
  preservando login e JWT existentes.
- Frontend passou a ter tipos de perfil da clinica, client de tenant, storage
  configuravel e formulario inicial do perfil na area admin.

Pendente para concluir a fase:

- Extrair shell administrativo compartilhado para todas as telas protegidas.
- Expandir bloqueio por permissao para operador, triagem e futuras rotas.
- Substituir textos fixos restantes por perfil carregado da API quando a
  inicializacao do frontend estiver estabilizada.
- Criar testes de rota para `tenant` com banco de integracao.

### Fase J: Cadastros base

Objetivo: migrar entidades que sustentam os demais fluxos.

Tarefas:

- pacientes [iniciado];
- profissionais;
- empresas;
- setores;
- cargos;
- convenios;
- procedimentos;
- exames;
- fornecedores.

Entregue em 2026-05-25:

- Criado modulo `patients` independente de agenda, empresas e convenios para
  evitar acoplamento prematuro.
- Criada tabela `patients` pela migration `20260525_0003`.
- Criadas permissoes `patients.read` e `patients.write` no RBAC inicial.
- Criados endpoints:
  - `GET /api/v1/patients`;
  - `GET /api/v1/patients/{patient_id}`;
  - `GET /api/v1/patients/cpf/{cpf}`;
  - `POST /api/v1/patients`;
  - `PUT /api/v1/patients/{patient_id}`.
- A lista de pacientes ja nasce com envelope `{ data, pagination }`, conforme
  contrato definido para APIs novas.
- Criada rota Next.js `/pacientes` com busca, lista, cadastro e edicao simples.
- Corrigido `AuditLog.payload` para usar `JSONB` em PostgreSQL e `JSON` em
  SQLite, preservando testes locais sem abandonar o tipo ideal de producao.

Pendente para concluir a fase:

- Profissionais.
- Empresas, setores e cargos.
- Convenios.
- Procedimentos, exames e fornecedores.
- Vinculos paciente-empresa e paciente-convenio.
- Ligacao futura entre `appointments.patient_*` e `patients.id`, depois que o
  fluxo de chamadas estiver preparado para essa mudanca.

### Fase K: Operacao clinica

Objetivo: cobrir agenda, chamadas, consultas e prontuario.

Tarefas:

- agendamentos completos;
- integracao agenda -> painel de chamadas;
- consulta;
- prontuario;
- receituarios;
- solicitacoes de exames;
- comprovantes.

### Fase L: Saude ocupacional

Objetivo: migrar regras ocupacionais brasileiras.

Tarefas:

- vinculos trabalhador-empresa;
- riscos;
- exames periodicos;
- ASO;
- questionario ocupacional;
- PDFs ocupacionais.

### Fase M: Financeiro e faturamento

Objetivo: migrar receitas, despesas, analytics e cobranca B2B.

Tarefas:

- pagamentos;
- despesas;
- DRE;
- relatorios financeiros;
- faturamento posterior;
- recibos;
- NFS-e.

### Fase N: Farmacia, estoque e documentos avancados

Objetivo: migrar estoque, dispensacao e documentos extras.

Tarefas:

- medicamentos;
- lotes;
- movimentacoes;
- dispensacao;
- documentos livres;
- relatorios assicronos.

### Fase O: Corte e limpeza

Objetivo: validar paridade funcional e remover amarras legadas.

Tarefas:

- validar fluxos ponta a ponta;
- revisar referencias CMI;
- congelar schema inicial completo;
- definir plano manual de migracao de dados, se necessario;
- documentar operacao final.

## 10. Criterios de aceite globais

- Ruff, pytest, TypeScript e build passam.
- Endpoints criticos possuem testes.
- Nenhum modulo novo depende de Flask.
- Nenhum texto/arquivo da V2 usa CMI como marca.
- PDFs usam perfil da clinica configuravel.
- Frontend usa RBAC para menus e acoes.
- API protege leitura e escrita de dados sensiveis.
- Stack sobe via Docker Compose.
- Documentacao esta atualizada.

## 11. Riscos

### R101: Tamanho do legado

Risco: tentar migrar tudo em uma unica fase gera acoplamento e regressao.

Mitigacao: implementar por fases H-O, com fatias pequenas e verificaveis.

### R102: PDF e relatorios divergentes

Risco: documentos clinicos e ocupacionais dependem de detalhes legais e layout.

Mitigacao: criar modulo de documentos antes de copiar layouts e validar cada
PDF contra exemplos do legado.

### R103: Dados brasileiros inconsistentes

Risco: CPF/CNPJ/valores monetarios em tipos diferentes quebram relatorios.

Mitigacao: normalizacao obrigatoria em schemas e migrations.

### R104: White-label incompleto

Risco: sobrar marca CMI em PDFs, storage, CSS, telas ou variaveis.

Mitigacao: checklist por fase e busca automatizada por `CMI`, `Centro Medico`,
`Centro Médico`, `logo_cmi` e `cmi_`.

## 12. Politica para IAs

Antes de implementar qualquer fase:

1. Ler este SDD.
2. Ler `docs/ARQUITETURA_GCO_SUPERSERVIDOR.md`.
3. Ler `docs/MAPA_MODULOS_GCO.md`.
4. Inspecionar os arquivos legados relacionados ao modulo.
5. Implementar apenas a fase solicitada.
6. Atualizar SDD e docs se mudar contrato ou arquitetura.
