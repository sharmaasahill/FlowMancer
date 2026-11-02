'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { errorMessage, systemApi } from '@/lib/api';
import type { Integrations, Stats } from '@/types';

interface SystemState {
  stats: Stats | null;
  integrations: Integrations | null;
  error: string | null;
  refresh: () => Promise<void>;
}

const SystemContext = createContext<SystemState>({ stats: null, integrations: null, error: null, refresh: async () => {} });

const STATS_MS = 15000;
const STATUS_MS = 60000; // the server caches the AI status for 60 s, so asking more often gains nothing

/**
 * One shared poller for stats + integration status (used by the sidebar, top bar and dashboard).
 * The two load separately: stats are quick, while the status check can take half a second.
 */
export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef({ stats: false, status: false });

  const loadStats = useCallback(async () => {
    if (busy.current.stats) return;
    busy.current.stats = true;
    try {
      setStats(await systemApi.stats());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busy.current.stats = false;
    }
  }, []);

  const loadStatus = useCallback(async () => {
    if (busy.current.status) return;
    busy.current.status = true;
    try {
      setIntegrations(await systemApi.integrations());
    } catch {
      /* the stats request reports connection problems */
    } finally {
      busy.current.status = false;
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadStats(), loadStatus()]);
  }, [loadStats, loadStatus]);

  useEffect(() => {
    refresh();
    const visible = () => document.visibilityState === 'visible';
    const a = setInterval(() => visible() && loadStats(), STATS_MS);
    const b = setInterval(() => visible() && loadStatus(), STATUS_MS);
    const onShow = () => visible() && loadStats();
    document.addEventListener('visibilitychange', onShow);
    return () => { clearInterval(a); clearInterval(b); document.removeEventListener('visibilitychange', onShow); };
  }, [refresh, loadStats, loadStatus]);

  return <SystemContext.Provider value={{ stats, integrations, error, refresh }}>{children}</SystemContext.Provider>;
}

export const useSystem = () => useContext(SystemContext);
