# Boas Praticas do Projeto GCO

Este guia define o padrao tecnico que deve ser seguido na V2 do GCO. Ele vale
para backend, frontend, infraestrutura, documentacao e para qualquer agente de
IA que participe da migracao.

## Principios

- Mantenha o codigo simples, explicito e pequeno.
- Aplique DRY quando houver duplicacao real de regra de negocio, contrato ou
  fluxo operacional. Evite abstracoes prematuras.
- Aplique KISS: uma funcao clara e previsivel e melhor que uma arquitetura
  sofisticada sem necessidade.
- Prefira nomes de dominio brasileiros: paciente, empresa, ASO, consulta,
  agendamento, sala, chamada, convenio, recibo e faturamento.
- O legado Flask/Vite e fonte de requisitos, nao de arquitetura.
- A V2 deve ser white-label. Nao grave marca, logo, textos institucionais ou
  valores de uma clinica especifica no codigo.
- Comentarios e docstrings devem ser em portugues do Brasil em todo codigo novo
  ou alterado.
- Nomes de variaveis, funcoes, classes e tipos devem ser autoexplicativos. Evite
  abreviacoes que escondam intencao, como `tmp`, `obj`, `val`, `x` ou `data`
  quando houver nome de dominio melhor.

## Python 3.14 e Zen do Python

- Prefira codigo explicito a comportamento magico.
- Uma funcao deve fazer uma coisa principal e retornar um resultado previsivel.
- Use nomes autoexplicativos para variaveis locais e argumentos, principalmente
  em regras de dominio clinico, financeiro e fiscal.
- Use type hints em assinaturas publicas, servicos, repositorios e schemas.
- Use `StrEnum` para enumeracoes persistidas ou expostas pela API.
- Use `Decimal` para dinheiro e nao `float`.
- Use `datetime` timezone-aware para eventos clinicos, financeiros e auditoria.
- CPF, CNPJ, CEP e documentos devem ser strings normalizadas, nunca inteiros.
- Evite heranca profunda. Use composicao, protocolos e classes pequenas.
- Trate excecoes de dominio com mensagens claras para o usuario final.
- Nao esconda efeitos colaterais: commits, auditoria, envio de eventos e
  chamadas externas devem aparecer no servico de aplicacao.

## FastAPI

- Rotas devem ser finas: validar entrada, chamar servico e traduzir erros.
- Servicos concentram regras de negocio e coordenam repositorios.
- Repositorios acessam dados e nao conhecem HTTP, JWT ou WebSocket.
- Schemas Pydantic devem ser especificos por caso de uso: create, update,
  read, filtro e resposta.
- Dependencias FastAPI devem ser pequenas e testaveis.
- Use `response_model` em rotas publicas.
- Nao coloque regra de autorizacao dentro do frontend como unica barreira. O
  backend sempre decide.
- Migrations Alembic sao obrigatorias para toda alteracao de schema.
- Nao use `Base.metadata.create_all()` em startup de producao.
- Novas APIs devem nascer em `/api/v1` e manter contratos documentados.
- Endpoints que alteram estado devem registrar auditoria quando afetarem rotina
  clinica, financeira, configuracao ou acesso.

## POO e Codigo Limpo

- Crie classes quando houver estado, contrato ou colaboracao clara.
- Evite classes utilitarias sem estado; prefira funcoes de modulo.
- Um metodo publico deve ter nome orientado ao dominio, nao ao detalhe tecnico.
- Injete dependencias por construtor quando elas fazem parte do caso de uso.
- Evite acoplamento circular entre modulos. Tipos compartilhados devem ficar em
  locais estaveis.
- Nao misture validacao de entrada, persistencia, regra de negocio e formatacao
  de resposta na mesma funcao.
- Docstrings devem explicar intencao, regra de negocio ou contrato; nao repetir
  literalmente o nome da funcao.

## PEP 8, Pylint e Ferramentas

- Use Ruff para formatacao e lint do backend.
- Use pytest para testes de unidade e integracao leve.
- Corrija warnings em vez de silencia-los sem justificativa.
- Imports devem ser organizados e sem dependencias nao usadas.
- Prefira arquivos pequenos por dominio a arquivos globais extensos.
- Testes devem cobrir regra de negocio, permissao e regressao de contrato.

## TypeScript e Next.js

- Use TypeScript estrito e evite `any`.
- Tipos de API devem ficar centralizados e refletir contratos reais do backend.
- O client HTTP deve ser unico e reutilizavel.
- Componentes client-side devem ser usados apenas quando houver estado, efeito,
  formulario, WebSocket ou acesso ao navegador.
- Rotas administrativas devem usar guarda de sessao e permissao.
- Menus devem vir de um registro unico de navegacao e ser filtrados por
  permissao.
- O painel de TV deve ser publico, resiliente a reconexao e visualmente simples.
- Nao duplique textos de marca. Use perfil da clinica ou configuracao publica.
- Formularios devem tratar erro de API e manter mensagens em portugues do Brasil.

## Docker e Nginx

- Imagens devem ser pequenas, reproduziveis e sem segredo embutido.
- Versoes atualizadas por Dependabot/Databot devem ser preservadas. Se uma
  atualizacao de imagem exigir migracao de volume, como PostgreSQL 18, documente
  e execute um plano de upgrade em vez de rebaixar silenciosamente a versao.
- Containers de aplicacao devem rodar sem usuario root sempre que possivel.
- Use `.dockerignore` para evitar cache, artefatos locais e dependencias
  instaladas no host.
- Defina healthchecks para servicos criticos.
- Nginx deve ser a entrada unica para web, `/api` e `/ws`.
- WebSocket precisa de headers de upgrade e timeouts adequados.
- Nao exponha PostgreSQL ou Redis publicamente em producao.
- Configuracao de producao vem de variaveis de ambiente ou secrets externos.
- Logs devem ir para stdout/stderr e nunca conter senhas, tokens ou documentos
  sensiveis completos.

## PostgreSQL e Alembic

- Use SQLAlchemy 2.x com `Mapped`/`mapped_column` nos models e migrations
  Alembic revisadas manualmente antes de aplicar.
- `alembic revision --autogenerate` e util para gerar candidatos, mas a
  migration final deve ser lida e ajustada por pessoa/agente antes de commit.
- `alembic check` deve passar contra PostgreSQL real antes de concluir fase com
  alteracao de schema.
- Nomeie constraints, indices e foreign keys com convencao previsivel para
  tornar diffs e rollbacks legiveis.
- Prefira migrations pequenas por fatia de dominio; em desenvolvimento com banco
  descartavel, ainda preserve cadeia Alembic linear para validar criacao do zero.
- PostgreSQL em Docker deve usar volume persistente. Para PostgreSQL 18+, monte
  o volume em `/var/lib/postgresql`; montar diretamente em
  `/var/lib/postgresql/data` dificulta upgrades de major version.
- Upgrade real de major version PostgreSQL exige backup e plano com `pg_upgrade`;
  destruir volume so e aceitavel em desenvolvimento ou ambiente explicitamente
  descartavel.

Referencias usadas:

- https://alembic.sqlalchemy.org/en/latest/autogenerate.html
- https://docs.sqlalchemy.org/en/20/orm/
- https://docs.sqlalchemy.org/en/20/dialects/postgresql.html
- https://docs.docker.com/guides/postgresql/immediate-setup-and-data-persistence/
- https://www.postgresql.org/docs/18/pgupgrade.html

## Migracao Flask para FastAPI

- Leia o legado para descobrir regra de negocio, fluxo e relatorios.
- Nao copie controllers, views, helpers globais ou arquitetura MVC customizada.
- Converta regras para servicos de dominio pequenos e testaveis.
- Converta queries importantes para repositorios SQLAlchemy 2.x.
- Todo comportamento migrado deve ganhar criterio de aceite no SDD.
- Quando houver duvida entre compatibilidade e simplicidade, documente a decisao
  e prefira a arquitetura nova.

## Migracao Vite para Next.js

- Use o App Router como base da nova experiencia.
- Priorize telas operacionais reais, nao paginas de apresentacao.
- Componentes devem ser reutilizados quando houver fluxo repetido, como shell,
  formularios, filtros, listas e estados vazios.
- Rotas antigas devem ser reinterpretadas em jornadas: recepcao, triagem,
  atendimento, admin, financeiro, documentos e painel.
- O frontend novo deve consumir APIs da V2, nao chamar servicos legados.

## Checklist Antes de Concluir uma Fase

- O codigo novo esta sem acoplamento a uma clinica especifica?
- A regra de negocio esta no servico, nao na rota ou no componente?
- Existe migration para mudanca de schema?
- Permissoes foram tratadas no backend?
- Contratos TypeScript e Pydantic foram atualizados juntos?
- Testes e lint aplicaveis foram executados ou a pendencia foi documentada?
- O SDD da fase foi atualizado com progresso, decisao e proximo passo?
