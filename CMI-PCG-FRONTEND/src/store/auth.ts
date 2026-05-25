import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthResponse, LoginCredentials } from '@/types';
import { tokenService } from '@/services/token.service';
import { authAPI as legacyAuthAPI } from '@/services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;

  accessToken: string | null;
  refreshToken: string | null;

  hydrateFromStorage: () => void;

  loginWithCredentials: (credentials: LoginCredentials) => Promise<void>;
  setAuthFromResponse: (resp: AuthResponse) => void;
  logout: () => void;
}

function normalizeUser(user: User): User {
  return {
    ...user,
    usuario: user.usuario || user.nome || user.email || '',
    tipo: user.tipo || user.staff_type || user.role?.slug || 'outro',
    nome: user.nome || user.usuario || '',
    email: user.email || user.usuario || '',
    staff_type: user.staff_type || user.tipo || 'outro',
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,

      hydrateFromStorage: () => {
        tokenService.migrateFromLegacyStorage();

        const accessToken = tokenService.getAccessToken();
        const refreshToken = tokenService.getRefreshToken();
        const user = tokenService.getUser();

        set({
          accessToken,
          refreshToken,
          user: user ? normalizeUser(user) : null,
          isAuthenticated: !!accessToken && !!user,
        });
      },

      setAuthFromResponse: (resp: AuthResponse) => {
        const user = normalizeUser(resp.user);
        tokenService.setAuthData(resp.access_token, resp.refresh_token, user);

        set({
          user,
          accessToken: resp.access_token,
          refreshToken: resp.refresh_token,
          isAuthenticated: true,
        });
      },

      loginWithCredentials: async (credentials: LoginCredentials) => {
        const resp = await legacyAuthAPI.login(credentials);
        get().setAuthFromResponse(resp);
      },

      logout: () => {
        tokenService.clearAll();
        set({
          user: null,
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (s) => ({
        user: s.user,
        isAuthenticated: s.isAuthenticated,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
    }
  )
);
