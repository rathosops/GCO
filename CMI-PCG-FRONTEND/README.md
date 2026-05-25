# CMI-PCG Frontend

Sistema de Gestão para Clínicas Médicas - Interface Web Moderna

## 🚀 Tecnologias

- **React 18** - Biblioteca JavaScript para construção de interfaces
- **TypeScript** - Superset JavaScript com tipagem estática
- **Vite** - Build tool moderna e rápida
- **TailwindCSS** - Framework CSS utilitário
- **Framer Motion** - Biblioteca de animações
- **React Router DOM** - Roteamento de páginas
- **Zustand** - Gerenciamento de estado
- **Axios** - Cliente HTTP
- **Lucide React** - Ícones modernos
- **Nginx** - Servidor web para produção

## 📋 Pré-requisitos

- Node.js 20+ e npm
- Docker e Docker Compose (para produção)
- Backend CMI-PCG-SERVER rodando

## 🛠️ Instalação e Execução

### Desenvolvimento Local

1. Clone o repositório:
```bash
git clone <seu-repositorio>
cd CMI-PCG-FRONTEND
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com as configurações corretas
# VITE_API_URL=http://localhost:5000
```

4. Execute o servidor de desenvolvimento:
```bash
npm run dev
```

O aplicativo estará disponível em `http://localhost:5173`

### Produção com Docker

#### Frontend Standalone
```bash
docker-compose up -d --build
```

#### Stack Completo (Frontend + Backend + Database)
```bash
# Use este para rodar todo o sistema
docker-compose -f docker-compose.full.yml up -d --build
```

O aplicativo estará disponível em `http://localhost:3000`

2. Para parar os containers:
```bash
docker-compose down
# ou
docker-compose -f docker-compose.full.yml down
```

### Build para Produção (sem Docker)

```bash
npm run build
```

Os arquivos otimizados estarão na pasta `dist/`

## 📁 Estrutura do Projeto

```
CMI-PCG-FRONTEND/
├── public/                 # Arquivos públicos estáticos
├── src/
│   ├── components/        # Componentes reutilizáveis
│   │   ├── DashboardLayout.tsx
│   │   ├── Loading.tsx
│   │   └── Modal.tsx
│   ├── pages/            # Páginas da aplicação
│   │   ├── LoginPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── PacientesPage.tsx
│   │   ├── AgendamentosPage.tsx
│   │   ├── ConsultasPage.tsx
│   │   ├── FinanceiroPage.tsx
│   │   ├── EmpresasPage.tsx
│   │   ├── ConveniosPage.tsx
│   │   ├── MedicosPage.tsx
│   │   └── ExamesPage.tsx
│   ├── services/         # Serviços e APIs
│   │   └── api.ts
│   ├── store/           # Gerenciamento de estado
│   │   └── auth.ts
│   ├── types/           # Definições TypeScript
│   │   └── index.ts
│   ├── hooks/           # Custom Hooks
│   │   └── useFetch.ts
│   ├── utils/           # Funções utilitárias
│   │   └── formatters.ts
│   ├── App.tsx          # Componente principal
│   ├── main.tsx         # Ponto de entrada
│   └── index.css        # Estilos globais
├── docker-compose.yml        # Docker standalone
├── docker-compose.full.yml   # Docker com backend integrado
├── Dockerfile               # Configuração Docker
├── nginx.conf              # Configuração Nginx
├── package.json            # Dependências
├── tailwind.config.js      # Configuração Tailwind
├── tsconfig.json           # Configuração TypeScript
└── vite.config.ts          # Configuração Vite
```

## 🎨 Funcionalidades Implementadas

### ✅ Autenticação
- Tela de login moderna e responsiva
- Proteção de rotas privadas
- Gerenciamento de sessão com Zustand

### ✅ Dashboard Layout
- Sidebar animada e retrátil
- Menu de navegação com ícones
- Header com informações do usuário
- Design responsivo para mobile

### ✅ Páginas Principais
- **Home**: Dashboard com estatísticas e atividades recentes
- **Pacientes**: Listagem e gestão de pacientes
- **Agendamentos**: Sistema de agendamentos (em desenvolvimento)
- **Consultas**: Registro de consultas médicas (em desenvolvimento)
- **Financeiro**: Controle financeiro com indicadores
- **Empresas**: Cadastro de empresas parceiras (em desenvolvimento)
- **Convênios**: Gestão de convênios (em desenvolvimento)
- **Médicos**: Cadastro de médicos (em desenvolvimento)
- **Exames**: Controle de exames (em desenvolvimento)

### ✅ Features de UI/UX
- Animações suaves com Framer Motion
- Design minimalista e moderno
- Paleta de cores profissional
- Feedback visual em todas as interações
- Scrollbar personalizada
- Cards com hover effects
- Botões com estados de loading

## 🔌 Integração com Backend

O frontend se comunica com o backend através da API REST. As configurações estão em:

- **Arquivo**: `src/services/api.ts`
- **URL Base**: Configurada via variável de ambiente `VITE_API_URL`
- **Endpoints disponíveis**:
  - `/auth/login` - Autenticação
  - `/pacientes` - CRUD de pacientes
  - `/agendamentos` - CRUD de agendamentos
  - `/consultas` - CRUD de consultas
  - `/empresas` - CRUD de empresas
  - `/convenios` - CRUD de convênios
  - `/medicos` - CRUD de médicos
  - `/pagamentos` - CRUD de pagamentos
  - `/exames` - CRUD de exames
  - `/relatorio_financeiro` - Relatórios financeiros

## 🎨 Customização de Cores

As cores do tema podem ser customizadas no arquivo `tailwind.config.js`:

```javascript
colors: {
  primary: { ... },    // Cor principal (azul)
  secondary: { ... },  // Cor secundária (cinza)
}
```

## 📱 Responsividade

O sistema é totalmente responsivo e funciona em:
- Desktop (1920px+)
- Laptop (1024px - 1919px)
- Tablet (768px - 1023px)
- Mobile (< 768px)

## 🔐 Autenticação

O sistema usa autenticação baseada em credenciais:
- Usuário e senha
- Diferentes tipos de usuário: admin, atendente, médico
- Persistência de sessão com localStorage

## 🚧 Próximos Passos

- [ ] Implementar formulários completos para todas as entidades
- [ ] Adicionar validação de formulários com React Hook Form
- [ ] Implementar tabelas com paginação e ordenação
- [ ] Adicionar gráficos interativos (Chart.js ou Recharts)
- [ ] Implementar sistema de notificações
- [ ] Adicionar filtros avançados
- [ ] Implementar exportação de dados (PDF, Excel)
- [ ] Adicionar testes unitários e E2E
- [ ] Implementar PWA (Progressive Web App)
- [ ] Adicionar modo escuro

## 📄 Licença

Este projeto é propriedade da CMI-PCG e está sob licença privada.

## 👥 Equipe

- Desenvolvimento: Equipe CMI-PCG
- Backend: Flask/Python
- Frontend: React/TypeScript

## 📞 Suporte

Para suporte e dúvidas, entre em contato com a equipe de TI da PGFN.