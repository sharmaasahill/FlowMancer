'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, FileText, Mail, Users } from 'lucide-react';
import { Empty, ErrorBanner, Loading, PageHeader, Segmented, StatusBadge } from '@/components/ui';
import { errorMessage, runsApi } from '@/lib/api';
import type { RunList } from '@/types';
import { formatDuration, summary, timeAgo, verdict } from '@/lib/utils';

const PAGE = 20;
const KIND_ICON = { lead: Users, email: Mail, document: FileText };

export default function HistoryPage() {
  const [kind, setKind] = useState<'all' | 'lead' | 'email' | 'document'>('all');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<RunList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runsApi.list({ kind: kind === 'all' ? undefined : kind, status: status || undefined, limit: PAGE, offset })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(errorMessage(e)));
  }, [kind, status, offset]);

  return (
    <div className="space-y-8 pt-4">
      <PageHeader eyebrow="History" title="Every item," accent="remembered."
        subtitle="Input, verdict, sources and every step, for everything FlowMancer has processed." />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented id="hist-kind" label="Type" value={kind} onChange={(k) => { setKind(k); setOffset(0); }}
          options={[{ value: 'all', label: 'All' }, { value: 'lead', label: 'Leads' }, { value: 'email', label: 'Emails' }, { value: 'document', label: 'Documents' }]} />
        <label htmlFor="status" className="sr-only">Status</label>
        <select id="status" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }} className="field !w-auto !rounded-full !py-2">
          <option value="">Any status</option>
          <option value="completed">Completed</option>
          <option value="running">Running</option>
          <option value="queued">Queued</option>
          <option value="failed">Failed</option>
        </select>
        {data && <span className="ml-auto font-mono text-xs text-fog">{data.total} item{data.total === 1 ? '' : 's'}</span>}
      </div>

      <ErrorBanner message={error} />
      <div className="glass overflow-hidden p-2">
        {!data ? <Loading /> : data.items.length === 0 ? <Empty title="Nothing here yet">Process something in the Studio and it shows up here.</Empty> : (
          <ul>
            {data.items.map((r, i) => {
              const Icon = KIND_ICON[r.kind];
              return (
                <motion.li key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}>
                  <Link href={`/history/${r.id}`}
                    className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-4 py-3.5 transition hover:bg-white/[0.04] md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_100px_90px_70px_auto]">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-blush transition group-hover:border-crimson-400/40 group-hover:bg-crimson/20">
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-bone">{summary(r)}</span>
                      <span className="block truncate font-mono text-[11px] text-fog">#{r.id} · {r.mode} · {r.source}</span>
                    </span>
                    <span className="hidden truncate text-sm text-bone/80 md:block">{r.status === 'completed' ? verdict(r) : r.error ? 'Error' : ''}</span>
                    <span className="hidden text-xs text-fog md:block">{timeAgo(r.created_at)}</span>
                    <span className="hidden font-mono text-xs tabular-nums text-fog md:block">{formatDuration(r.duration_seconds)}</span>
                    <span className="hidden md:block"><StatusBadge status={r.status} /></span>
                    <ChevronRight className="h-4 w-4 text-ash transition group-hover:translate-x-0.5 group-hover:text-blush" aria-hidden />
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {data && data.total > PAGE && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono text-xs text-fog">{offset + 1}–{Math.min(offset + PAGE, data.total)} of {data.total}</span>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" disabled={offset === 0} onClick={() => setOffset(offset - PAGE)}>Previous</button>
            <button type="button" className="btn-ghost" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
