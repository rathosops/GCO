/**
 * Contexto de autenticação
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../services/api';
import type { Usuario } from '../types';

interface AuthContextType {
  usuario: Usuario | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    const savedUser = localStorage.getItem('usuario');

    if (token && savedUser) {
      try {
        setUsuario(JSON.parse(savedUser));
      } catch {
        api.logout();
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await api.login(username, password);
    const user = response.usuario as Usuario;
    setUsuario(user);
    localStorage.setItem('usuario', JSON.stringify(user));
  };

  const logout = () => {
    api.logout();
    setUsuario(null);
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        isAuthenticated: !!usuario,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
