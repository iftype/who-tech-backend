import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { getToken, setToken, clearToken } from '../lib/auth.js';
import { apiFetch } from '../lib/api.js';

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login: (secret: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken);

  const login = useCallback(async (secret: string) => {
    setToken(secret);
    setTokenState(secret);
    await apiFetch('/admin/status');
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
