# 📝 Exemplos de Código - CMI-PCG Frontend

## 🎯 Como Adicionar uma Nova Página

### 1. Crie o arquivo da página

```typescript
// src/pages/NovaFuncionalidadePage.tsx
import { motion } from 'framer-motion';
import { Settings, Plus } from 'lucide-react';

export default function NovaFuncionalidadePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-secondary-900">
          Nova Funcionalidade
        </h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </motion.button>
      </div>

      <div className="card">
        <p>Conteúdo da nova funcionalidade</p>
      </div>
    </div>
  );
}
```

### 2. Adicione a rota em App.tsx

```typescript
// src/App.tsx
import NovaFuncionalidadePage from '@/pages/NovaFuncionalidadePage';

// Dentro do DashboardLayout
<Route path="nova-funcionalidade" element={<NovaFuncionalidadePage />} />
```

### 3. Adicione no menu lateral

```typescript
// src/components/DashboardLayout.tsx
import { Settings } from 'lucide-react';

const menuItems = [
  // ... outros itens
  { icon: Settings, label: 'Nova Funcionalidade', path: '/nova-funcionalidade' },
];
```

## 📋 Como Criar um Formulário

### Formulário Simples

```typescript
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function FormularioPaciente() {
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await pacientesAPI.create(formData);
      // Sucesso
    } catch (error) {
      // Erro
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Nome</label>
        <input
          type="text"
          value={formData.nome}
          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          className="input"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">CPF</label>
        <input
          type="text"
          value={formData.cpf}
          onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
          className="input"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="input"
        />
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="submit"
        className="btn-primary w-full"
      >
        Salvar
      </motion.button>
    </form>
  );
}
```

## 📊 Como Criar uma Tabela

```typescript
import { useState, useEffect } from 'react';
import { Search, Edit, Trash2 } from 'lucide-react';

export default function TabelaPacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPacientes();
  }, []);

  const loadPacientes = async () => {
    try {
      const response = await pacientesAPI.getAll();
      setPacientes(response.data);
    } catch (error) {
      console.error('Erro ao carregar pacientes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading text="Carregando pacientes..." />;

  return (
    <div className="card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-secondary-200">
              <th className="text-left p-4">Nome</th>
              <th className="text-left p-4">CPF</th>
              <th className="text-left p-4">Email</th>
              <th className="text-center p-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pacientes.map((paciente) => (
              <tr key={paciente.id} className="border-b border-secondary-100 hover:bg-secondary-50">
                <td className="p-4">{paciente.nome}</td>
                <td className="p-4">{paciente.cpf}</td>
                <td className="p-4">{paciente.email}</td>
                <td className="p-4 flex justify-center gap-2">
                  <button className="btn-secondary">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button className="btn-secondary text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## 💾 Como Usar a API

### GET - Buscar dados

```typescript
const [pacientes, setPacientes] = useState([]);

// Buscar todos
const loadAll = async () => {
  const response = await pacientesAPI.getAll();
  setPacientes(response.data);
};

// Buscar com filtros
const loadWithFilters = async () => {
  const response = await pacientesAPI.getAll({
    nome: 'João',
    cpf: '12345678900'
  });
  setPacientes(response.data);
};

// Buscar por ID
const loadById = async (id: number) => {
  const response = await pacientesAPI.getById(id);
  setPaciente(response.data);
};
```

### POST - Criar novo registro

```typescript
const createPaciente = async (data: Paciente) => {
  try {
    const response = await pacientesAPI.create(data);
    console.log('Paciente criado:', response.data);
    // Atualizar lista
    loadAll();
  } catch (error) {
    console.error('Erro ao criar paciente:', error);
  }
};
```

### PUT - Atualizar registro

```typescript
const updatePaciente = async (id: number, data: Partial<Paciente>) => {
  try {
    const response = await pacientesAPI.update(id, data);
    console.log('Paciente atualizado:', response.data);
  } catch (error) {
    console.error('Erro ao atualizar paciente:', error);
  }
};
```

### DELETE - Remover registro

```typescript
const deletePaciente = async (id: number) => {
  if (confirm('Deseja realmente excluir?')) {
    try {
      await pacientesAPI.delete(id);
      loadAll(); // Recarregar lista
    } catch (error) {
      console.error('Erro ao excluir paciente:', error);
    }
  }
};
```

## 🎨 Como Usar Animações

### Fade In

```typescript
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.5 }}
>
  Conteúdo aparece gradualmente
</motion.div>
```

### Slide In

```typescript
<motion.div
  initial={{ x: -100, opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  transition={{ type: 'spring', stiffness: 100 }}
>
  Conteúdo desliza da esquerda
</motion.div>
```

### List Animation

```typescript
{items.map((item, index) => (
  <motion.div
    key={item.id}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
  >
    {item.name}
  </motion.div>
))}
```

### Hover Effects

```typescript
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  className="btn-primary"
>
  Clique aqui
</motion.button>
```

## 🔔 Como Adicionar Notificações

### Criar Store de Notificações

```typescript
// src/store/notification.ts
import { create } from 'zustand';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (type: Notification['type'], message: string) => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (type, message) => {
    const id = Date.now().toString();
    set((state) => ({
      notifications: [...state.notifications, { id, type, message }]
    }));
    // Auto remove após 5 segundos
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      }));
    }, 5000);
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id)
    })),
}));
```

### Usar Notificações

```typescript
const { addNotification } = useNotificationStore();

// Sucesso
addNotification('success', 'Paciente cadastrado com sucesso!');

// Erro
addNotification('error', 'Erro ao salvar paciente');

// Info
addNotification('info', 'Verificando dados...');
```

## 📱 Como Tornar Responsivo

### Mobile First

```typescript
<div className="
  flex flex-col          // Mobile: coluna
  md:flex-row            // Tablet+: linha
  lg:gap-6               // Desktop: gap maior
">
  <div className="
    w-full               // Mobile: largura total
    md:w-1/2             // Tablet+: metade
    lg:w-1/3             // Desktop: um terço
  ">
    Conteúdo
  </div>
</div>
```

### Breakpoints Tailwind

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Sidebar Responsiva

```typescript
const [sidebarOpen, setSidebarOpen] = useState(false);

// Mobile: sidebar overlay
// Desktop: sidebar fixa
<aside className={`
  fixed lg:relative
  ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
  transition-transform
`}>
  Sidebar
</aside>
```

## 🔒 Como Proteger Rotas

```typescript
// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'atendente' | 'medico';
}

export default function ProtectedRoute({ 
  children, 
  requiredRole 
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (requiredRole && user?.tipo !== requiredRole) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

// Uso
<Route 
  path="/admin" 
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminPage />
    </ProtectedRoute>
  } 
/>
```

---

**Mais exemplos serão adicionados conforme o projeto evolui!**