'use client';

import { useEffect, useState } from 'react';
import { authHeaders, runsApi } from '@/lib/api';
import type { Run } from '@/types';

const FINISHED = ['completed', 'failed'];

/**
 * Follow a run live over Server-Sent Events.
 * Uses fetch (not EventSource) so the request can carry the sign-in token.
 * Falls back to polling if the stream fails, e.g. behind a proxy that buffers SSE.
 */
export function useRunStream(runId: number | null) {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRun(null);
    setError(null);
    if (runId === null) return;

    const controller = new AbortController();
    let finished = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const accept = (data: Run) => {
      setRun(data);
      if (FINISHED.includes(data.status)) finished = true;
    };

    const poll = () => {
      if (finished || timer) return;
      timer = setInterval(async () => {
        try {
          const data = await runsApi.get(runId);
          accept(data);
          if (finished && timer) clearInterval(timer);
        } catch {
          setError('Lost connection to the backend.');
          if (timer) clearInterval(timer);
        }
      }, 2000);
    };

    (async () => {
      try {
        const res = await fetch(runsApi.eventsUrl(runId), { headers: authHeaders(), signal: controller.signal });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut;
          while ((cut = buffer.indexOf('\n\n')) >= 0) {
            const event = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const data = event.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
            if (!data || data === '{}') continue;
            try {
              const parsed = JSON.parse(data) as Run;
              if (parsed?.id) accept(parsed);
            } catch {
              /* ignore keep-alives and partial events */
            }
          }
        }
        if (!finished) poll();
      } catch (e) {
        if (!controller.signal.aborted) poll();
      }
    })();

    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [runId]);

  return { run, error };
}
