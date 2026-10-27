'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, MinusCircle, XCircle } from 'lucide-react';
import type { Step } from '@/types';
import { cn, elapsedSince, formatDuration } from '@/lib/utils';
import { Spinner } from '@/components/ui';

function stepDuration(step: Step): string | null {
  if (!step.started_at) return null;
  const end = step.finished_at ? new Date(step.finished_at).getTime() : Date.now();
  return formatDuration((end - new Date(step.started_at).getTime()) / 1000);
}

function Icon({ status }: { status: Step['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />;
    case 'running':
      return <Spinner className="text-blue-600" label="Running" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-600" aria-hidden />;
    case 'skipped':
      return <MinusCircle className="h-5 w-5 text-gray-400" aria-hidden />;
    default:
      return <Circle className="h-5 w-5 text-gray-300" aria-hidden />;
  }
}

/** Vertical timeline of pipeline steps. Running steps show a live timer. */
export default function RunSteps({ steps, startedAt }: { steps: Step[]; startedAt?: string | null }) {
  const [, tick] = useState(0);
  const running = steps.some((s) => s.status === 'running');
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      {running && startedAt && (
        <p className="mb-3 text-xs text-gray-500" aria-live="polite">
          Elapsed {formatDuration(elapsedSince(startedAt))}
        </p>
      )}
      <ol className="space-y-1" aria-label="Processing steps">
        {steps.map((step) => {
          const duration = stepDuration(step);
          const expandable = !!step.output && step.status !== 'running';
          return (
            <li key={step.name}>
              <button
                type="button"
                disabled={!expandable}
                onClick={() => setOpen(open === step.name ? null : step.name)}
                aria-expanded={expandable ? open === step.name : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm',
                  expandable && 'hover:bg-gray-50',
                )}
              >
                <Icon status={step.status} />
                <span className={cn('flex-1 font-medium', step.status === 'pending' ? 'text-gray-400' : 'text-gray-900')}>
                  {step.name}
                  <span className="sr-only">: {step.status}</span>
                </span>
                {duration && <span className="text-xs tabular-nums text-gray-500">{duration}</span>}
              </button>
              {open === step.name && step.output && (
                <pre className="mb-2 ml-10 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-700">
                  {step.output}
                </pre>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
