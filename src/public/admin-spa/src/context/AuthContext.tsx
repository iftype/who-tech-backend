import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { getToken, setToken, clearToken } from '../lib/auth.js';
import { UNAUTHORIZED_EVENT } from '../lib/api.js';

import { adminApi } from '../lib/admin-api.js';

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  login: (secret: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// 토큰의 단일 출처는 이 컨텍스트다. 저장소(localStorage)는 새로고침 뒤 복원용이고,
// 서버가 401을 주면 apiFetch가 UNAUTHORIZED_EVENT로 알려 여기서 상태를 지운다
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
  }, []);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  // 서버가 비밀키를 받아들인 뒤에만 로그인 상태로 바꾼다. 실패하면 저장한 토큰도 지운다
  const login = useCallback(async (secret: string) => {
    setToken(secret);
    try {
      await adminApi.status();
    } catch (e) {
      clearToken();
      throw e;
    }
    setTokenState(secret);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
