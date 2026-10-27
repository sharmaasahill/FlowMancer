'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { errorMessage, workflowsApi } from '@/lib/api';
import type { WorkflowExecution } from '@/types';
import { ErrorBanner, Spinner, StatusBadge, buttonClass, inputClass } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { SAMPLE_INPUTS } from '@/lib/workflowTemplates';

export default function RunPanel({ workflowId, firstTask, dirty }: { workflowId: number; firstTask?: string; dirty: boolean }) {
  const [input, setInput] = useState(JSON.stringify(SAMPLE_INPUTS[firstTask || 'lead'], null, 2));
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [history, setHistory] = useState<WorkflowExecution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setInput(JSON.stringify(SAMPLE_INPUTS[firstTask || 'lead'], null, 2));
  }, [firstTask]);

  useEffect(() => {
    workflowsApi.executions(workflowId).then(setHistory).catch(() => {});
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [workflowId]);

  const follow = (id: number) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const ex = await workflowsApi.execution(id);
        setExecution(ex);
        if (ex.status === 'completed' || ex.status === 'failed') {
          if (timer.current) clearInterval(timer.current);
          workflowsApi.executions(workflowId).then(setHistory).catch(() => {});
        }
      } catch (e) {
        setError(errorMessage(e));
        if (timer.current) clearInterval(timer.current);
      }
    }, 1500);
  };

  const run = async () => {
    setError(null);
    let data: Record<string, any>;
    try {
      data = JSON.parse(input);
    } catch {
      setError('Input must be valid JSON.');
      return;
    }
    try {
      const ex = await workflowsApi.run(workflowId, data);
      setExecution(ex);
      follow(ex.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const running = execution && (execution.status === 'pending' || execution.status === 'running');

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="wf-input" className="mb-1 block text-sm font-medium text-gray-700">Test input (JSON)</label>
        <textarea id="wf-input" rows={7} value={input} onChange={(e) => setInput(e.target.value)} className={`${inputClass} font-mono text-xs`} />
      </div>
      {dirty && <p className="text-xs text-orange-700">You have unsaved changes. Save first; runs use the saved version.</p>}
      <ErrorBanner message={error} />
      <button type="button" onClick={run} disabled={!!running} className={buttonClass.primary}>
        {running ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" aria-hidden />} Run workflow
      </button>

      {execution && (
        <div aria-live="polite">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <span className="font-semibold">Run #{execution.id}</span>
            <StatusBadge status={execution.status} />
          </div>
          <ol className="space-y-1.5 text-sm">
            {(execution.agent_logs || []).map((l, i) => (
              <li key={i} className="flex items-start gap-2">
                <StatusBadge status={l.status} />
                <span>
                  <span className="font-medium">{l.label}</span>: {l.detail}
                  {l.run_id && <> (<Link className="text-blue-700 hover:underline" href={`/history/${l.run_id}`}>details</Link>)</>}
                </span>
              </li>
            ))}
            {running && <li className="flex items-center gap-2 text-gray-500"><Spinner className="h-4 w-4" /> working...</li>}
          </ol>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-700">Recent runs</h3>
          <ul className="space-y-1 text-sm">
            {history.slice(0, 8).map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => { setExecution(h); if (h.status === 'pending' || h.status === 'running') follow(h.id); }}
                  className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-gray-50">
                  <span className="w-10 font-medium">#{h.id}</span>
                  <span className="flex-1 text-gray-600">{formatDate(h.started_at)}</span>
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
