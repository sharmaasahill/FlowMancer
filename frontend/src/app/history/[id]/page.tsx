'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { errorMessage, runsApi } from '@/lib/api';
import { useRunStream } from '@/lib/useRunStream';
import type { Approval, Run } from '@/types';
import RunSteps from '@/components/RunSteps';
import RunResult from '@/components/RunResult';
import { Card, ErrorBanner, PageHeader, Spinner, StatusBadge } from '@/components/ui';
import { formatDate, formatDuration, KIND_LABELS } from '@/lib/utils';

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

  if (error) return <ErrorBanner message={error} />;
  if (!run) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8 text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <Link href="/history" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> History
      </Link>
      <PageHeader title={`${KIND_LABELS[run.kind]} #${run.id}`}
        subtitle={`${run.mode} mode, from ${run.source}, ${formatDate(run.created_at)}, took ${formatDuration(run.duration_seconds)}`}>
        <StatusBadge status={run.status} />
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <Card title="Input">
            <dl className="space-y-2 text-sm">
              {Object.entries(run.input_data || {}).filter(([, v]) => v !== null && v !== '').map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-medium text-gray-500">{k.replace('_', ' ')}</dt>
                  <dd className="whitespace-pre-wrap break-words text-gray-900">
                    {typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0, 3000)}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          {run.steps && <Card title="Steps"><RunSteps steps={run.steps} startedAt={run.created_at} /></Card>}
          {run.workflow_execution_id && (
            <p className="text-sm text-gray-600">Part of workflow run #{run.workflow_execution_id}</p>
          )}
        </div>
        <Card title="Result" className="xl:col-span-2">
          {run.status === 'completed' || run.status === 'failed'
            ? <RunResult run={run} approvals={approvals} />
            : <p className="py-12 text-center text-sm text-gray-500">Still working. This page updates live.</p>}
        </Card>
      </div>
    </div>
  );
}
