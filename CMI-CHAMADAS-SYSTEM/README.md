# CMI Sistema de Chamadas

Sistema de chamadas de pacientes para clínica médica, integrado com o sistema CMI-PCG.

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                     CMI-CHAMADAS-SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript + Vite)                           │
│  ├── /painel      → TV recepção (WebSocket, auto-refresh)       │
│  ├── /medico      → Tela médico (lista pacientes, botão chamar) │
│  ├── /triagem     → Tela triagem IMESC                          │
│  ├── /admin       → Monitoramento geral                         │
│  └── /dev         → Debug/logs/simulador                        │
├─────────────────────────────────────────────────────────────────┤
│  Backend (FastAPI + SQLAlchemy + WebSocket)                     │
│  ├── /api/v1/auth        → Autenticação JWT                     │
│  ├── /api/v1/chamadas    → CRUD chamadas                        │
│  ├── /api/v1/agendamentos→ Proxy p/ agendamentos existentes     │
│  ├── /api/v1/triagem     → Gestão triagem IMESC                 │
│  ├── /api/v1/dev         → Endpoints para desenvolvedores       │
│  └── /ws/*               → WebSocket para tempo real            │
├─────────────────────────────────────────────────────────────────┤
│  DB: cmi-pcg-server-db (tabelas: agendamentos + chamadas)       │
│  Redis: filas de chamadas + pub/sub para WebSocket              │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Início Rápido

### Pré-requisitos

- Docker e Docker Compose
- Rede `cmi-network` criada
- Banco PostgreSQL e Redis do CMI-PCG-SERVER rodando

### Iniciar o Sistema

```bash
# Criar rede se não existir
docker network create cmi-network

# Subir os containers
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### Acessar

- **Painel (TV)**: http://localhost:3001/painel
- **Login**: http://localhost:3001/login
- **API Docs**: http://localhost:5001/docs

### Credenciais Padrão

| Usuário  | Senha      | Tipo    |
|----------|------------|---------|
| admin    | admin123   | ADMIN   |
| medico   | medico123  | MEDICO  |
| triagem  | triagem123 | TRIAGEM |
| dev      | dev123     | DEV     |

## 📱 Telas

### Painel (TV Recepção)
- Exibe últimas 5 chamadas
- Áudio de notificação
- Text-to-speech para chamar pacientes
- Atualização em tempo real via WebSocket

### Tela Médico
- Lista pacientes aguardando
- Botão para chamar paciente
- Gerenciar atendimento (iniciar/finalizar)
- Pacientes IMESC só aparecem após triagem

### Tela Triagem
- Lista pacientes IMESC aguardando
- Botão para concluir triagem
- Campo de observações

### Tela Admin
- Dashboard com estatísticas
- Monitoramento de chamadas ativas
- Visão geral de agendamentos

### Tela Dev
- Stats de conexões WebSocket
- Status do banco de dados
- Simulador de chamadas
- Logs em tempo real

## 🔧 Desenvolvimento

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 5001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 📦 Estrutura de Arquivos

```
cmi-chamadas-system/
├── docker-compose.yml
├── .env
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/
│   └── app/
│       ├── main.py
│       ├── api/
│       │   └── v1/
│       │       ├── auth.py
│       │       ├── chamadas.py
│       │       ├── triagem.py
│       │       ├── agendamentos.py
│       │       ├── dev.py
│       │       └── websocket.py
│       ├── core/
│       │   ├── config.py
│       │   ├── database.py
│       │   └── security.py
│       ├── models/
│       │   ├── usuario.py
│       │   ├── chamada.py
│       │   ├── sala.py
│       │   └── triagem.py
│       ├── schemas/
│       ├── services/
│       └── websocket/
│           └── manager.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── nginx/
    └── src/
        ├── App.tsx
        ├── pages/
        ├── hooks/
        ├── services/
        ├── context/
        └── types/
```

## 🔌 Integração

O sistema utiliza a tabela `agendamentos` do CMI-PCG-SERVER e cria tabelas adicionais:

- `usuarios_chamadas` - Usuários do sistema de chamadas
- `chamadas` - Histórico de chamadas
- `salas_chamadas` - Configuração de salas
- `triagem_imesc` - Controle de triagem IMESC

## 📝 Licença

Proprietary - CMI
