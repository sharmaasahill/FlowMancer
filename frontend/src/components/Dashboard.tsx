'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Activity, CheckSquare, Clock, Gauge } from 'lucide-react';
import { errorMessage, runsApi, systemApi } from '@/lib/api';
import type { Integrations, Run, Stats } from '@/types';
import { Card, Empty, ErrorBanner, PageHeader, Spinner, StatusBadge } from '@/components/ui';
import { formatDate, formatDuration, KIND_LABELS, summary } from '@/lib/utils';

const KIND_COLORS = { lead: '#2563eb', email: '#16a34a', document: '#d97706' };
const LEVEL_COLORS: Record<string, string> = { High: '#16a34a', Medium: '#eab308', Low: '#9ca3af' };

function StatCard({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: typeof Activity; hint?: string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <Icon className="h-5 w-5 text-gray-400" aria-hidden />
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function toRows(obj: Record<string, number>) {
  return Object.entries(obj).filter(([k]) => k && k !== 'null').map(([name, value]) => ({ name, value }));
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Run[]>([]);
  const [integrations, setIntegrations] = useState<Integrations | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => Promise.all([systemApi.stats(), runsApi.list({ limit: 6 }), systemApi.integrations()])
      .then(([s, r, i]) => { setStats(s); setRecent(r.items); setIntegrations(i); setError(null); })
      .catch((e) => setError(errorMessage(e)));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (error && !stats) return <div className="space-y-6"><PageHeader title="Dashboard" /><ErrorBanner message={error} /></div>;
  if (!stats) return <div className="flex justify-center py-24"><Spinner className="h-8 w-8 text-blue-600" /></div>;

  const t = stats.totals;
  const days = stats.runs_per_day.map((d) => ({ ...d, label: d.date.slice(5) }));
  const quals = toRows(stats.leads.by_qualification).filter((r) => r.value > 0);
  const categories = toRows(stats.emails.by_category);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Live numbers from everything FlowMancer has processed" />
      <ErrorBanner message={error} />

      {integrations && integrations.ai.reachable === false && (
        <ErrorBanner message={`AI model unavailable: ${integrations.ai.detail}. Start the Ollama app and try again.`} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Items processed" value={t.runs} icon={Activity}
          hint={t.in_progress ? `${t.in_progress} in progress` : `${t.failed} failed`} />
        <StatCard label="Success rate" value={t.success_rate === null ? '-' : `${t.success_rate}%`} icon={Gauge} />
        <StatCard label="Avg processing time" value={formatDuration(t.avg_duration_seconds)} icon={Clock} />
        <Link href="/approvals" className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <StatCard label="Waiting for approval" value={t.pending_approvals} icon={CheckSquare} hint="Click to review" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Processed per day (last 14 days)" className="xl:col-span-2">
          {t.runs === 0 ? <Empty>Nothing processed yet. <Link className="text-blue-700 underline" href="/use-cases">Try it</Link></Empty> : (
            <div className="h-64" role="img" aria-label="Bar chart of items processed per day by type">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Legend />
                  {(['lead', 'email', 'document'] as const).map((k) => (
                    <Bar key={k} dataKey={k} name={KIND_LABELS[k]} stackId="a" fill={KIND_COLORS[k]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Lead quality">
          {quals.length === 0 ? <Empty>No leads yet</Empty> : (
            <>
              <p className="text-sm text-gray-600">Average score <span className="font-bold text-gray-900">{stats.leads.avg_score}</span></p>
              <div className="h-52" role="img" aria-label={`Lead quality: ${quals.map((q) => `${q.name} ${q.value}`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={quals} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} label>
                      {quals.map((q) => <Cell key={q.name} fill={LEVEL_COLORS[q.name]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Email categories">
          {categories.length === 0 ? <Empty>No emails yet</Empty> : (
            <div className="h-52" role="img" aria-label={`Email categories: ${categories.map((c) => `${c.name} ${c.value}`).join(', ')}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} layout="vertical">
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={80} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" name="Emails" fill={KIND_COLORS.email} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Recent activity" className="xl:col-span-2" actions={<Link href="/history" className="text-sm font-semibold text-blue-700 hover:underline">View all</Link>}>
          {recent.length === 0 ? <Empty>No activity yet</Empty> : (
            <ul className="divide-y divide-gray-100">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/history/${r.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:bg-gray-50">
                    <span className="w-20 font-medium">{KIND_LABELS[r.kind]}</span>
                    <span className="flex-1 truncate text-gray-700">{summary(r)}</span>
                    <span className="text-xs text-gray-500">{formatDate(r.created_at)}</span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="text-xs text-gray-500">
        {t.workflows} workflows ({t.active_workflows} active), {t.workflow_executions} workflow runs, {t.knowledge_documents} knowledge documents.
      </p>
    </div>
  );
}

