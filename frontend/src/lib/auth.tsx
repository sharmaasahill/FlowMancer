'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { authApi, clearToken, getToken, setToken, UNAUTHORIZED_EVENT } from '@/lib/api';
import type { AuthSession, User } from '@/types';

/** 'unreachable': there is a saved session, but the backend didn't answer (down, or still waking up). */
type Status = 'loading' | 'signed-in' | 'signed-out' | 'unreachable';

interface AuthState {
  status: Status;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: (credential: string) => Promise<void>;
  signOut: () => void;
  retry: () => void;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthState>({
  status: 'loading', user: null,
  signIn: async () => {}, signUp: async () => {}, signInWithGoogle: async () => {}, signOut: () => {},
  retry: () => {}, setUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('signed-out');
  }, []);

  const restore = useCallback(() => {
    if (!getToken()) {
      setStatus('signed-out');
      return;
    }
    setStatus('loading');
    authApi.me()
      .then((u) => { setUser(u); setStatus('signed-in'); })
      // Only a rejected token signs you out; a network error keeps the session for a retry
      .catch((err) => (err instanceof AxiosError && err.response?.status === 401 ? signOut() : setStatus('unreachable')));
  }, [signOut]);

  useEffect(restore, [restore]);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, signOut);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, signOut);
  }, [signOut]);

  const start = useCallback((s: AuthSession) => {
    setToken(s.token);
    setUser(s.user);
    setStatus('signed-in');
  }, []);

  const signIn = useCallback(async (email: string, password: string) => start(await authApi.login(email, password)), [start]);
  const signUp = useCallback(async (name: string, email: string, password: string) =>
    start(await authApi.register(name, email, password)), [start]);
  const signInWithGoogle = useCallback(async (credential: string) => start(await authApi.google(credential)), [start]);

  return (
    <AuthContext.Provider value={{ status, user, signIn, signUp, signInWithGoogle, signOut, retry: restore, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
