/**
 * Auth context: holds the current user (or null) and exposes login/logout.
 *
 * On mount it calls GET /auth/me to restore an existing cookie session, so a
 * page refresh keeps the student signed in. The JWT stays in the httpOnly
 * cookie and is never read by JS.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { CurrentUser } from '../types';
import { api } from '../lib/api';

interface AuthState {
  user: CurrentUser | null;
  loading: boolean; // initial session check in flight
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // Restore session on mount.
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((user) => {
        if (!cancelled) setState({ user, loading: false, error: null });
      })
      .catch(() => {
        // network error or 401 — treat as logged out
        if (!cancelled) setState({ user: null, loading: false, error: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { user } = await api.login(email, password);
      setState({ user, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setState({ user: null, loading: false, error: message });
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
