'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { ErrorBanner, Spinner, StatusBadge } from '@/components/ui';
import { errorMessage, workflowsApi } from '@/lib/api';
import type { WorkflowExecution } from '@/types';
import { timeAgo } from '@/lib/utils';
import { SAMPLE_INPUTS } from '@/lib/workflowTemplates';

export default function RunPanel({ workflowId, firstTask, dirty, onExecution }: {
  workflowId: number; firstTask?: string; dirty: boolean; onExecution: (ex: WorkflowExecution | null) => void;
}) {
  const [input, setInput] = useState(JSON.stringify(SAMPLE_INPUTS[firstTask || 'lead'], null, 2));
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [history, setHistory] = useState<WorkflowExecution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setInput(JSON.stringify(SAMPLE_INPUTS[firstTask || 'lead'], null, 2)), [firstTask]);

  useEffect(() => {
    workflowsApi.executions(workflowId).then(setHistory).catch(() => {});
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [workflowId]);

  const show = (ex: WorkflowExecution | null) => {
    setExecution(ex);
    onExecution(ex);
  };

  const follow = (id: number) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const ex = await workflowsApi.execution(id);
        show(ex);
        if (ex.status === 'completed' || ex.status === 'failed') {
          if (timer.current) clearInterval(timer.current);
          workflowsApi.executions(workflowId).then(setHistory).catch(() => {});
        }
      } catch (e) {
        setError(errorMessage(e));
        if (timer.current) clearInterval(timer.current);
      }
    }, 1200);
  };

  const run = async () => {
    setError(null);
    let data: Record<string, any>;
    try {
      data = JSON.parse(input);
    } catch {
      setError('Test input must be valid JSON.');
      return;
    }
    try {
      const ex = await workflowsApi.run(workflowId, data);
      show(ex);
      follow(ex.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const running = execution && (execution.status === 'pending' || execution.status === 'running');

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="wf-input" className="mb-1.5 block text-[13px] font-medium text-bone/85">Test input (JSON)</label>
        <textarea id="wf-input" rows={7} value={input} onChange={(e) => setInput(e.target.value)} className="field resize-none font-mono text-xs" />
      </div>
      {dirty && <p className="text-xs text-amber">Unsaved changes. Runs use the saved version.</p>}
      <ErrorBanner message={error} />
      <button type="button" onClick={run} disabled={!!running} className="btn-primary w-full !py-2.5">
        {running ? <Spinner className="h-4 w-4 text-white" /> : <Play className="h-4 w-4" aria-hidden />} {running ? 'Running...' : 'Run workflow'}
      </button>

      {execution && (
        <div aria-live="polite" className="rounded-2xl border border-white/[0.07] bg-noir-950/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs text-fog">Run #{execution.id}</span>
            <StatusBadge status={execution.status} />
          </div>
          <ol className="space-y-2 text-sm">
            <AnimatePresence initial={false}>
              {(execution.agent_logs || []).map((l, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${l.status === 'completed' ? 'bg-crimson-400 shadow-[0_0_8px_#D64545]' : l.status === 'failed' ? 'bg-coral' : 'bg-ash'}`} aria-hidden />
                  <span className="min-w-0 text-bone/90">
                    <span className="font-medium text-bone">{l.label}</span> <span className="text-fog">· {l.detail}</span>
                    {l.run_id && <> <Link className="text-blush hover:underline" href={`/history/${l.run_id}`}>details</Link></>}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
            {running && <li className="flex items-center gap-2 text-fog"><Spinner className="h-3.5 w-3.5" /> working...</li>}
          </ol>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <p className="eyebrow mb-2 !text-[10px]">Recent runs</p>
          <ul className="space-y-0.5 text-sm">
            {history.slice(0, 6).map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => { show(h); if (h.status === 'pending' || h.status === 'running') follow(h.id); }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-white/[0.04]">
                  <span className="w-10 font-mono text-xs text-fog">#{h.id}</span>
                  <span className="flex-1 text-xs text-fog">{timeAgo(h.started_at)}</span>
                  <StatusBadge status={h.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
