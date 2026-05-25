import type { User } from '@/types';

const TOKEN_KEY = 'cmi_access_token';
const REFRESH_TOKEN_KEY = 'cmi_refresh_token';
const USER_KEY = 'cmi_user';

// legado zustand persist (se existir em algum momento)
const LEGACY_ZUSTAND_KEY = 'auth-storage';

class TokenService {
  getAccessToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setAccessToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  removeAccessToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setRefreshToken(token: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  }

  removeRefreshToken(): void {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  getUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  setUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  removeUser(): void {
    localStorage.removeItem(USER_KEY);
  }

  setAuthData(accessToken: string, refreshToken: string, user: User): void {
    this.setAccessToken(accessToken);
    this.setRefreshToken(refreshToken);
    this.setUser(user);
  }

  clearAll(): void {
    this.removeAccessToken();
    this.removeRefreshToken();
    this.removeUser();
  }

  hasToken(): boolean {
    return !!this.getAccessToken();
  }

  /**
   * Migração defensiva:
   * - Se ainda existir um persist antigo em `auth-storage`, tenta extrair tokens/user
   * - Só migra se ainda NÃO existirem tokens no formato novo
   */
  migrateFromLegacyStorage(): void {
    const hasNew = !!this.getAccessToken() || !!this.getRefreshToken() || !!this.getUser();
    if (hasNew) return;

    const legacyRaw = localStorage.getItem(LEGACY_ZUSTAND_KEY);
    if (!legacyRaw) return;

    try {
      // zustand persist geralmente salva: { state: {...}, version: n }
      const parsed = JSON.parse(legacyRaw) as any;
      const state = parsed?.state ?? parsed;

      const accessToken = state?.accessToken || state?.access_token || null;
      const refreshToken = state?.refreshToken || state?.refresh_token || null;
      const user = state?.user || null;

      if (accessToken && refreshToken && user) {
        this.setAuthData(accessToken, refreshToken, user as User);
      }
    } catch {
      // ignora migração
    }
  }
}

export const tokenService = new TokenService();
export default tokenService;
