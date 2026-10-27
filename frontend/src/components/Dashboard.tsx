'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, FileText, Mail, Users } from 'lucide-react';
import ArtTile from '@/components/ArtTile';
import { useAssistant } from '@/components/assistant/AssistantProvider';
import { ActivityChart, CategoryBars, QUALITY_COLORS, QualityDonut } from '@/components/charts';
import Orb from '@/components/Orb';
import { CountUp, Empty, ErrorBanner, Loading, Panel, rise, stagger, StatusBadge } from '@/components/ui';
import { approvalsApi, runsApi } from '@/lib/api';
import { useSystem } from '@/lib/system';
import type { Approval, Run } from '@/types';
import { greeting, summary, timeAgo, verdict } from '@/lib/utils';

const KIND_ICON = { lead: Users, email: Mail, document: FileText };

function Stat({ label, value, decimals, suffix, hint }: {
  label: string; value: number | null | undefined; decimals?: number; suffix?: string; hint?: string;
}) {
  return (
    <motion.div variants={rise} className="glass rounded-[22px] px-5 py-4">
      <p className="eyebrow !text-[10px]">{label}</p>
      <p className="mt-2 font-display text-[34px] leading-none text-bone">
        {value === null || value === undefined ? '-' : <CountUp value={value} decimals={decimals} suffix={suffix} />}
      </p>
      {hint && <p className="mt-1 text-xs text-fog">{hint}</p>}
    </motion.div>
  );
}

function AICore({ recent, approvals }: { recent: Run[]; approvals: Approval[] }) {
  const { integrations } = useSystem();
  const ai = integrations?.ai;
  const live = recent.filter((r) => r.status === 'running' || r.status === 'queued');
  return (
    <motion.aside variants={rise} className="glass relative self-start overflow-hidden p-6 xl:sticky xl:top-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 opacity-60" aria-hidden
        style={{ background: 'radial-gradient(60% 80% at 50% 0%, rgba(155,19,19,0.45), transparent 70%)' }} />
      <div className="relative flex flex-col items-center text-center">
        <Orb size={92} state={live.length ? 'thinking' : ai?.reachable === false ? 'offline' : 'idle'} />
        <p className="eyebrow mt-6">AI core</p>
        <p className="mt-2 font-display text-[28px] leading-tight text-bone">{ai ? ai.model.replace(/ \(.*\)$/, '') : 'Connecting...'}</p>
        <p className={`mt-1 text-sm ${ai?.reachable ? 'text-jade' : 'text-fog'}`}>
          {ai ? (ai.reachable ? (live.length ? `Working on ${live.length} item${live.length > 1 ? 's' : ''}` : 'Online and idle') : ai.detail) : ' '}
        </p>
        {!!ai?.fallbacks.length && <p className="mt-1 text-xs text-ash">Backup: {ai.fallbacks.join(' → ')}</p>}
      </div>
      <AskStrip />

      <div className="relative mt-7">
        <div className="mb-3 flex items-center justify-between">
          <p className="eyebrow !text-[10px]">Recent activity</p>
          <Link href="/history" className="text-xs font-semibold text-blush hover:underline">All</Link>
        </div>
        {recent.length === 0 ? <p className="py-4 text-center text-sm text-fog">Nothing yet</p> : (
          <ul className="space-y-1">
            {recent.slice(0, 5).map((r) => {
              const Icon = KIND_ICON[r.kind];
              return (
                <li key={r.id}>
                  <Link href={`/history/${r.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.04]">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-blush">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-bone">{summary(r)}</span>
                      <span className="block truncate text-xs text-fog">{r.status === 'completed' ? verdict(r) : r.status} · {timeAgo(r.created_at)}</span>
                    </span>
                    {r.status !== 'completed' && <StatusBadge status={r.status} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {approvals.length > 0 && (
        <div className="relative mt-6 rounded-2xl border border-crimson-400/25 bg-crimson/[0.08] p-4">
          <p className="eyebrow !text-[10px] !text-blush">Waiting for you</p>
          <ul className="mt-2 space-y-1.5">
            {approvals.slice(0, 3).map((a) => <li key={a.id} className="truncate text-sm text-bone">{a.title}</li>)}
          </ul>
          <Link href="/approvals" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blush hover:gap-2.5 [transition:gap_.2s]">
            Review {approvals.length > 3 ? `all ${approvals.length}` : ''} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}
    </motion.aside>
  );
}

export default function Dashboard() {
  const { stats, error } = useSystem();
  const [recent, setRecent] = useState<Run[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const load = () => {
      runsApi.list({ limit: 6 }).then((r) => setRecent(r.items)).catch(() => {});
      approvalsApi.list('pending').then(setApprovals).catch(() => {});
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (!stats) return error ? <ErrorBanner message={error} /> : <Loading label="Waking up" />;

  const t = stats.totals;
  const today = stats.runs_per_day.at(-1);
  const todayCount = today ? today.lead + today.email + today.document : 0;
  const hot = stats.leads.by_qualification.High ?? 0;
  const days = stats.runs_per_day.map((d) => ({
    ...d, label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
  const quality = Object.entries(stats.leads.by_qualification).map(([name, value]) => ({ name, value })).filter((d) => d.value > 0);
  const categories = Object.entries(stats.emails.by_category).filter(([k]) => k && k !== 'null')
    .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const parts = [
    t.pending_approvals ? `${t.pending_approvals} approval${t.pending_approvals > 1 ? 's' : ''} waiting` : null,
    hot ? `${hot} hot lead${hot > 1 ? 's' : ''}` : null,
    `${todayCount} processed today`,
  ].filter(Boolean);

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <motion.header variants={rise} className="pb-2 pt-4">
          <p className="eyebrow mb-4">{now ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ' '}</p>
          <h1 className="font-display text-[52px] leading-[0.98] tracking-tight text-bone sm:text-[68px]">
            {now ? greeting(now) : 'Hello'}<em className="text-blush">.</em>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fog">
            {t.runs === 0
              ? 'Nothing processed yet. Drop in a lead, an email or an invoice and watch the agents work.'
              : <>{parts.join(' · ')}.</>}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/studio" className="btn-primary !px-5 !py-2.5">Open Studio <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            {t.pending_approvals > 0 && <Link href="/approvals" className="btn-ghost !px-5 !py-2.5">Review approvals</Link>}
          </div>
        </motion.header>

        <motion.div variants={stagger(0.08)} className="grid gap-4 md:h-[400px] md:grid-cols-5 md:grid-rows-2">
          <ArtTile variant="lead" href="/studio?kind=lead" title="Leads" size="lg" value={stats.leads.count}
            detail={stats.leads.count ? `Average score ${stats.leads.avg_score} · ${hot} hot` : 'Score your first lead'}
            className="md:col-span-3 md:row-span-2" />
          <ArtTile variant="email" href="/studio?kind=email" title="Emails" value={stats.emails.count}
            detail={stats.emails.count ? `${stats.emails.by_priority.urgent ?? 0} urgent · ${stats.emails.by_category.spam ?? 0} spam filtered` : 'Triage an email'}
            className="md:col-span-2" />
          <ArtTile variant="document" href="/studio?kind=document" title="Documents" value={stats.documents.count}
            detail={stats.documents.count ? `${stats.documents.approval_required} needed approval` : 'Check an invoice'}
            className="md:col-span-2" />
        </motion.div>

        <motion.div variants={stagger(0.05)} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Success rate" value={t.success_rate} decimals={t.success_rate !== null && t.success_rate % 1 ? 1 : 0} suffix="%" />
          <Stat label="Avg time" value={t.avg_duration_seconds} decimals={1} suffix="s" hint="per item, start to verdict" />
          <Stat label="Processed" value={t.runs} hint={t.in_progress ? `${t.in_progress} in progress` : `${t.failed} failed`} />
          <Stat label="Live workflows" value={t.active_workflows} hint={`${t.workflow_executions} run${t.workflow_executions === 1 ? '' : 's'}`} />
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Panel eyebrow="Last 14 days" title="Activity" className="lg:col-span-2">
            {t.runs === 0 ? <Empty title="A quiet two weeks">Processed items will show up here.</Empty> : (
              <div className="h-60" role="img" aria-label="Items processed per day, by type"><ActivityChart data={days} /></div>
            )}
          </Panel>
          <Panel eyebrow="Leads" title="Quality mix">
            {quality.length === 0 ? <Empty title="No leads yet" /> : (
              <>
                <div className="relative h-44" role="img" aria-label={quality.map((q) => `${q.name} ${q.value}`).join(', ')}>
                  <QualityDonut data={quality} />
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="font-display text-4xl leading-none"><CountUp value={stats.leads.avg_score} decimals={0} /></p>
                      <p className="eyebrow mt-1 !text-[9px]">avg score</p>
                    </div>
                  </div>
                </div>
                <ul className="mt-4 flex justify-center gap-4 text-xs text-fog">
                  {quality.map((q) => (
                    <li key={q.name} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: QUALITY_COLORS[q.name] }} />{q.name} {q.value}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>

        {categories.length > 0 && (
          <Panel eyebrow="Emails" title="What people write about">
            <div className="h-44" role="img" aria-label={categories.map((c) => `${c.name} ${c.value}`).join(', ')}>
              <CategoryBars data={categories} />
            </div>
          </Panel>
        )}
      </div>

      <AICore recent={recent} approvals={approvals} />
    </motion.div>
  );
}

function AskStrip() {
  const { setOpen, send } = useAssistant();
  const [q, setQ] = useState('');
  const go = (text: string) => {
    setOpen(true);
    if (text.trim()) send(text);
    setQ('');
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); go(q); }} className="relative mt-6">
      <label htmlFor="ask-core" className="sr-only">Ask FlowMancer</label>
      <input id="ask-core" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything..."
        className="field !rounded-full !py-3 pl-4 pr-12" />
      <button type="submit" aria-label="Ask"
        className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-crimson text-white shadow-ember transition hover:bg-crimson-500">
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}
