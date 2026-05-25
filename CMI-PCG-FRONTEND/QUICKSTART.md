# 🚀 Início Rápido - CMI-PCG Frontend

## ⚡ Setup Rápido (5 minutos)

### 1. Pré-requisitos
```bash
# Verifique se você tem Node.js 20+
node --version

# Verifique se você tem npm
npm --version

# Verifique se você tem Docker (opcional, para produção)
docker --version
```

### 2. Instalação

```bash
# Entre no diretório do projeto
cd CMI-PCG-FRONTEND

# Execute o script de setup (Linux/Mac)
chmod +x setup.sh
./setup.sh

# OU instale manualmente
npm install
cp .env.example .env
```

### 3. Configuração

Edite o arquivo `.env`:
```env
VITE_API_URL=http://localhost:5000
```

### 4. Executar

**Desenvolvimento:**
```bash
npm run dev
```
Acesse: http://localhost:5173

**Produção com Docker:**
```bash
docker-compose up -d --build
```
Acesse: http://localhost:3000

## 📋 Credenciais de Teste

Para testar o login, use as credenciais do seu backend. Exemplo:
- **Usuário**: admin
- **Senha**: sua_senha

## 🎨 Tecnologias Principais

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| React | 18.2 | UI Framework |
| TypeScript | 5.2 | Type Safety |
| Vite | 5.0 | Build Tool |
| TailwindCSS | 3.4 | CSS Framework |
| Framer Motion | 10.16 | Animações |

## 📁 Estrutura Básica

```
CMI-PCG-FRONTEND/
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │   ├── DashboardLayout.tsx
│   │   ├── Modal.tsx
│   │   └── Loading.tsx
│   ├── pages/              # Páginas da aplicação
│   │   ├── LoginPage.tsx       ✅ Implementada
│   │   ├── HomePage.tsx        ✅ Implementada
│   │   ├── PacientesPage.tsx   ✅ Template
│   │   └── ... (outras)        🚧 Em desenvolvimento
│   ├── services/           # APIs
│   │   └── api.ts
│   ├── store/              # Estado global
│   │   └── auth.ts
│   └── types/              # TypeScript types
│       └── index.ts
├── public/                 # Assets estáticos
├── docker-compose.yml      # Docker config
└── package.json           # Dependências
```

## 🎯 Funcionalidades Disponíveis

### ✅ Implementadas
- ✅ Sistema de autenticação
- ✅ Layout responsivo com sidebar
- ✅ Dashboard com estatísticas
- ✅ Navegação entre páginas
- ✅ Animações e transições
- ✅ Dark/Light mode preparado
- ✅ Templates de páginas principais

### 🚧 Em Desenvolvimento
- 🚧 Formulários completos (CRUD)
- 🚧 Tabelas com paginação
- 🚧 Gráficos e relatórios
- 🚧 Sistema de notificações
- 🚧 Upload de arquivos
- 🚧 Impressão de documentos

## 🔧 Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor dev
npm run build            # Build para produção
npm run preview          # Preview do build
npm run lint             # Verifica código

# Docker
docker-compose up -d     # Sobe containers
docker-compose down      # Para containers
docker-compose logs -f   # Visualiza logs
```

## 🎨 Customização

### Cores
Edite `tailwind.config.js`:
```javascript
colors: {
  primary: { /* Sua cor principal */ },
  secondary: { /* Sua cor secundária */ },
}
```

### Logo
Substitua o arquivo em `public/logo.svg`

### Título
Edite `index.html`:
```html
<title>Seu Título Aqui</title>
```

## 📱 Páginas Disponíveis

| Rota | Componente | Status |
|------|-----------|--------|
| `/login` | LoginPage | ✅ Completa |
| `/` | HomePage | ✅ Completa |
| `/pacientes` | PacientesPage | 🟡 Template |
| `/agendamentos` | AgendamentosPage | 🟡 Template |
| `/consultas` | ConsultasPage | 🟡 Template |
| `/financeiro` | FinanceiroPage | 🟡 Template |
| `/empresas` | EmpresasPage | 🟡 Template |
| `/convenios` | ConveniosPage | 🟡 Template |
| `/medicos` | MedicosPage | 🟡 Template |
| `/exames` | ExamesPage | 🟡 Template |

## 🐛 Troubleshooting

### Erro ao instalar dependências
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Porta 5173 já em uso
```bash
# Edite vite.config.ts e mude a porta
server: {
  port: 3001  // Nova porta
}
```

### Backend não conecta
1. Verifique se o backend está rodando
2. Confirme a URL no arquivo `.env`
3. Verifique CORS no backend

## 📚 Próximos Passos

1. **Configure o backend**: Certifique-se que CMI-PCG-SERVER está rodando
2. **Customize cores**: Ajuste o tema no `tailwind.config.js`
3. **Implemente formulários**: Complete os CRUDs nas páginas
4. **Adicione validações**: Use React Hook Form
5. **Integre gráficos**: Adicione Chart.js ou Recharts

## 🆘 Ajuda

- 📖 Leia o [README.md](README.md) completo
- 💻 Veja [CONTRIBUTING.md](CONTRIBUTING.md) para padrões de código
- 🐛 Abra uma issue no repositório
- 📧 Entre em contato com a equipe

## 🎉 Pronto!

Seu frontend está configurado! Execute `npm run dev` e comece a desenvolver.

**Última atualização**: Dezembro 2024