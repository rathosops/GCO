# Arquitetura GCO Superservidor

## Visao

O GCO V2 e uma plataforma modular para clinicas ocupacionais brasileiras. A
entrega continua sendo um monolito modular com:

- FastAPI para API, WebSocket, regras e documentos;
- Next.js para telas administrativas, operacionais e painel;
- PostgreSQL para persistencia;
- Redis para cache, pub/sub e jobs leves;
- Nginx como gateway unico.

## Camadas

```text
Router FastAPI
  -> Schemas Pydantic
  -> Services de dominio
  -> Repositories SQLAlchemy
  -> Models SQLAlchemy
  -> PostgreSQL
```

Routers nao devem conter regra de negocio. Services nao devem depender de
`Request`, `Response`, `Depends` ou objetos HTTP. Repositories nao devem decidir
politica de negocio.

## Modulos centrais

- `tenant`: perfil da clinica, branding, parametros operacionais.
- `identity`: usuarios, papeis, permissoes e sessoes.
- `patients`: cadastro e historico resumido de pacientes.
- `professionals`: medicos, enfermeiros, atendentes e assistentes sociais.
- `companies`: empresas, setores, cargos e vinculos.
- `appointments`: agenda, importacao e disponibilidade.
- `calls`: chamadas em tempo real e painel de TV.
- `clinical_records`: consultas, prontuario e anamnese.
- `occupational_health`: ASO, riscos, questionarios e NR-7.
- `exams`: catalogo e solicitacoes de exames.
- `prescriptions`: receituarios e itens.
- `finance`: pagamentos, despesas, DRE e analytics.
- `billing`: faturamento posterior e recibos por empresa.
- `inventory`: farmacia, lotes, estoque e dispensacao.
- `documents`: templates, renderizacao e arquivos.
- `reports`: consultas analiticas e jobs de exportacao.
- `integrations`: CEP, NFS-e, Google Forms e notificacoes.
- `audit`: trilha de auditoria.

## White-label

O modulo `tenant` deve ser a fonte para:

- nome exibido;
- logo;
- dados fiscais;
- assinatura visual;
- textos de rodape;
- cores;
- limites operacionais.

O frontend deve ler esses dados por `/api/v1/tenant/profile` e aplicar no shell,
login, painel e documentos. O backend deve injetar o perfil nos builders de PDF.

## Documentos e PDF

Documentos devem ser tratados como produtos do dominio. Exemplo:

```text
documents/
  templates/
  renderers/
  storage.py
  service.py
```

WeasyPrint pode ser o renderer principal. ReportLab deve ser usado apenas se
houver motivo tecnico claro.

Todo documento deve ter:

- tipo;
- versao;
- contexto validado;
- nome de arquivo previsivel;
- permissao necessaria;
- log de auditoria;
- dados da clinica vindos do tenant.

## Frontend

O Next.js deve usar App Router e separar:

- rotas autenticadas em `(dashboard)`;
- login em `(auth)`;
- painel publico em `/painel`;
- componentes comuns em `components`;
- features em `features`;
- acesso a API em `lib`.

Menus devem vir de um registry:

```ts
type ModuleNavItem = {
  label: string;
  href: string;
  permission: string;
  icon: React.ComponentType;
};
```

## Padroes de codigo

Backend:

- nomes em ingles tecnico para arquivos e tabelas;
- mensagens e docstrings em portugues do Brasil;
- excecoes de dominio especificas;
- commits pequenos por fase;
- testes para regras criticas.

Frontend:

- TypeScript estrito;
- componentes pequenos;
- nenhum `any` sem justificativa;
- API client centralizado;
- tratamento uniforme de `401`, `403`, `409` e erros de blob.

