'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, clearToken, getToken, setToken, UNAUTHORIZED_EVENT } from '@/lib/api';
import type { User } from '@/types';

type Status = 'loading' | 'signed-in' | 'signed-out';

interface AuthState {
  status: Status;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState>({
  status: 'loading', user: null,
  signIn: async () => {}, signUp: async () => {}, signOut: () => {}, setUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('signed-out');
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setStatus('signed-out');
      return;
    }
    authApi.me()
      .then((u) => { setUser(u); setStatus('signed-in'); })
      .catch(() => signOut());
  }, [signOut]);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, signOut);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, signOut);
  }, [signOut]);

  const signIn = useCallback(async (email: string, password: string) => {
    const s = await authApi.login(email, password);
    setToken(s.token);
    setUser(s.user);
    setStatus('signed-in');
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const s = await authApi.register(name, email, password);
    setToken(s.token);
    setUser(s.user);
    setStatus('signed-in');
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, signIn, signUp, signOut, setUser }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
