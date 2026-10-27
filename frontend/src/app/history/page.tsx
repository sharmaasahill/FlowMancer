'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { errorMessage, runsApi } from '@/lib/api';
import type { RunList } from '@/types';
import { Card, Empty, ErrorBanner, PageHeader, Spinner, StatusBadge, buttonClass, inputClass } from '@/components/ui';
import { formatDate, formatDuration, KIND_LABELS, summary } from '@/lib/utils';

const PAGE = 25;

export default function HistoryPage() {
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<RunList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runsApi.list({ kind: kind || undefined, status: status || undefined, limit: PAGE, offset })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(errorMessage(e)));
  }, [kind, status, offset]);

  return (
    <div className="space-y-6">
      <PageHeader title="History" subtitle="Every item FlowMancer has processed, with its input, result and steps" />
      <div className="flex flex-wrap gap-3">
        <div>
          <label htmlFor="kind" className="sr-only">Type</label>
          <select id="kind" value={kind} onChange={(e) => { setKind(e.target.value); setOffset(0); }} className={inputClass}>
            <option value="">All types</option>
            <option value="lead">Leads</option>
            <option value="email">Emails</option>
            <option value="document">Documents</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="sr-only">Status</label>
          <select id="status" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }} className={inputClass}>
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="running">Running</option>
            <option value="queued">Queued</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>
      <ErrorBanner message={error} />
      <Card className="overflow-x-auto p-0">
        {!data ? <div className="flex justify-center py-12"><Spinner className="h-8 w-8 text-blue-600" /></div>
          : data.items.length === 0 ? <Empty>Nothing here yet.</Empty> : (
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left text-gray-700">
                <tr>
                  <th scope="col" className="px-4 py-3">#</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Summary</th>
                  <th scope="col" className="px-4 py-3">Mode</th>
                  <th scope="col" className="px-4 py-3">Source</th>
                  <th scope="col" className="px-4 py-3">When</th>
                  <th scope="col" className="px-4 py-3">Took</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><Link href={`/history/${r.id}`} className="font-semibold text-blue-700 hover:underline">{r.id}</Link></td>
                    <td className="px-4 py-3">{KIND_LABELS[r.kind]}</td>
                    <td className="max-w-md truncate px-4 py-3">{summary(r)}</td>
                    <td className="px-4 py-3">{r.mode}</td>
                    <td className="px-4 py-3">{r.source}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatDuration(r.duration_seconds)}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Card>
      {data && data.total > PAGE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">{offset + 1}-{Math.min(offset + PAGE, data.total)} of {data.total}</span>
          <div className="flex gap-2">
            <button type="button" className={buttonClass.secondary} disabled={offset === 0} onClick={() => setOffset(offset - PAGE)}>Previous</button>
            <button type="button" className={buttonClass.secondary} disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
