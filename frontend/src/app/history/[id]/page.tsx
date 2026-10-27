'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Orb from '@/components/Orb';
import RunResult from '@/components/RunResult';
import RunSteps from '@/components/RunSteps';
import { ErrorBanner, Loading, Panel, stagger, StatusBadge } from '@/components/ui';
import { errorMessage, runsApi } from '@/lib/api';
import { useRunStream } from '@/lib/useRunStream';
import type { Approval, Run } from '@/types';
import { formatDate, formatDuration, KIND_LABELS, summary } from '@/lib/utils';

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [initial, setInitial] = useState<Run | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runsApi.get(id).then(setInitial).catch((e) => setError(errorMessage(e)));
  }, [id]);

  const live = initial && (initial.status === 'queued' || initial.status === 'running');
  const { run: streamed } = useRunStream(live ? id : null);
  const run = streamed || initial;

  useEffect(() => {
    if (run?.status === 'completed') runsApi.approvals(id).then(setApprovals).catch(() => {});
  }, [run?.status, id]);

  if (error) return <div className="pt-4"><ErrorBanner message={error} /></div>;
  if (!run) return <Loading />;
  const finished = run.status === 'completed' || run.status === 'failed';

  return (
    <div className="space-y-8 pt-4">
      <Link href="/history" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blush hover:gap-2.5 [transition:gap_.2s]">
        <ArrowLeft className="h-4 w-4" aria-hidden /> History
      </Link>
      <header className="flex flex-wrap items-center gap-5">
        <Orb size={56} state={run.status === 'failed' ? 'error' : finished ? 'done' : 'thinking'} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-2">{KIND_LABELS[run.kind]} #{run.id}</p>
          <h1 className="truncate font-display text-[40px] leading-none text-bone sm:text-5xl">{summary(run)}</h1>
          <p className="mt-2 text-sm text-fog">
            {run.mode} mode · from {run.source} · {formatDate(run.created_at)} · took {formatDuration(run.duration_seconds)}
            {run.ai_model && <> · {run.ai_model}</>}
          </p>
        </div>
        <StatusBadge status={run.status} />
      </header>

      <motion.div variants={stagger()} initial="hidden" animate="show" className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel eyebrow="Input" title="What came in">
            <dl className="space-y-3 text-sm">
              {Object.entries(run.input_data || {}).filter(([, v]) => v !== null && v !== '').map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs capitalize text-fog">{k.replace(/_/g, ' ')}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words text-bone/90">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0, 3000)}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
          {run.steps && <Panel eyebrow="Pipeline" title="Steps"><RunSteps steps={run.steps} /></Panel>}
          {run.workflow_execution_id && <p className="text-sm text-fog">Part of workflow run #{run.workflow_execution_id}</p>}
        </div>
        <Panel eyebrow="Verdict" title="Result">
          {finished ? <RunResult run={run} approvals={approvals} /> : (
            <div className="flex flex-col items-center py-16 text-center">
              <Orb size={64} state="thinking" />
              <p className="mt-5 font-display text-2xl">Still thinking</p>
              <p className="mt-1 text-sm text-fog">This page updates live.</p>
            </div>
          )}
        </Panel>
      </motion.div>
    </div>
  );
}
