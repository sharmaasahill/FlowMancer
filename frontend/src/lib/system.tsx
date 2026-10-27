'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { errorMessage, systemApi } from '@/lib/api';
import type { Integrations, Stats } from '@/types';

interface SystemState {
  stats: Stats | null;
  integrations: Integrations | null;
  error: string | null;
  refresh: () => void;
}

const SystemContext = createContext<SystemState>({ stats: null, integrations: null, error: null, refresh: () => {} });

const POLL_MS = 15000;

/** One shared poller for stats + integration status (used by the sidebar, top bar and dashboard). */
export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const [s, i] = await Promise.all([systemApi.stats(), systemApi.integrations()]);
      setStats(s);
      setIntegrations(i);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return <SystemContext.Provider value={{ stats, integrations, error, refresh }}>{children}</SystemContext.Provider>;
}

export const useSystem = () => useContext(SystemContext);
