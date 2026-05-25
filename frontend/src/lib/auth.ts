"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getMe, logout } from "@/lib/api";
import type { User } from "@/types/api";

const TOKEN_KEY = "gco.accessToken";
const USER_KEY = "gco.user";

export type Session = {
  token: string;
  user: User;
};

export function readToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function saveSession(token: string, user: User): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function readCachedUser(): User | null {
  const value = window.localStorage.getItem(USER_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as User;
  } catch {
    clearSession();
    return null;
  }
}

export function useSessionGuard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const signOut = useCallback(async () => {
    const token = readToken();

    if (token) {
      await logout(token).catch(() => undefined);
    }

    clearSession();
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    const token = readToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    const cachedUser = readCachedUser();

    if (cachedUser) {
      setSession({ token, user: cachedUser });
    }

    getMe(token)
      .then((user) => {
        saveSession(token, user);
        setSession({ token, user });
      })
      .catch(() => {
        clearSession();
        router.replace("/login");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router]);

  return { session, isLoading, signOut };
}
