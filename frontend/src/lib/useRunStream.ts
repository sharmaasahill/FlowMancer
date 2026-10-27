'use client';

import { useEffect, useRef, useState } from 'react';
import { runsApi } from '@/lib/api';
import type { Run } from '@/types';

/**
 * Follow a run live over Server-Sent Events.
 * Falls back to polling if the stream errors (e.g. a proxy that buffers SSE).
 */
export function useRunStream(runId: number | null) {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRun(null);
    setError(null);
    if (runId === null) return;

    let finished = false;
    const source = new EventSource(runsApi.eventsUrl(runId));

    const stopPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Run;
        if (data && data.id) {
          setRun(data);
          if (data.status === 'completed' || data.status === 'failed') finished = true;
        }
      } catch {
        /* ignore keep-alives */
      }
    };
    source.addEventListener('done', () => {
      finished = true;
      source.close();
    });
    source.onerror = () => {
      source.close();
      if (finished || pollRef.current) return;
      pollRef.current = setInterval(async () => {
        try {
          const data = await runsApi.get(runId);
          setRun(data);
          if (data.status === 'completed' || data.status === 'failed') stopPolling();
        } catch {
          setError('Lost connection to the backend.');
          stopPolling();
        }
      }, 2000);
    };

    return () => {
      source.close();
      stopPolling();
    };
  }, [runId]);

  return { run, error };
}
