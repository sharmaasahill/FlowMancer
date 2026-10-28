'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, ExternalLink, FileText, Mail, Users } from 'lucide-react';
import { TokenChart } from '@/components/charts';
import { Badge, Empty, ErrorBanner, Loading, PageHeader, Panel, Segmented, Stat, stagger, StatusBadge } from '@/components/ui';
import { errorMessage, systemApi } from '@/lib/api';
import type { UsageFeature, UsageReport } from '@/types';
import { compactNumber, formatUsd, timeAgo } from '@/lib/utils';

const RANGES = [
  { value: '1', label: 'Today' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
] as const;

const FEATURES: Record<UsageFeature, { label: string; item: string; icon: typeof Users }> = {
  lead: { label: 'Leads', item: 'lead', icon: Users },
  email: { label: 'Emails', item: 'email', icon: Mail },
  document: { label: 'Documents', item: 'document', icon: FileText },
  assistant: { label: 'Ask FlowMancer', item: 'question', icon: Bot },
};

const PRICING_URL = 'https://ai.google.dev/gemini-api/docs/pricing';
const LIMITS_URL = 'https://ai.google.dev/gemini-api/docs/rate-limits';

/** "2026-10-27" -> "Oct 27" without shifting the day in negative time zones */
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const th = 'px-3 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ash';
const td = 'px-3 py-2.5 tabular-nums';

export default function UsagePage() {
  const [range, setRange] = useState<(typeof RANGES)[number]['value']>('7');
  const [data, setData] = useState<UsageReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => systemApi.usage(Number(range))
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => alive && setError(errorMessage(e)));
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [range]);

  const t = data?.totals;
  const tokens = t ? t.input_tokens + t.output_tokens : 0;
  const [scale, unit] = tokens >= 1e6 ? [1e6, 'M'] : tokens >= 1e3 ? [1e3, 'K'] : [1, ''];
  const local = data?.provider === 'ollama';

  return (
    <div className="space-y-8 pt-4">
      <PageHeader eyebrow="Usage" title="What the AI" accent="costs."
        subtitle="Every model request made for your account: tokens, response time, busy models and an estimated bill.">
        <Segmented id="usage-range" label="Time range" value={range} onChange={setRange} options={[...RANGES]} />
      </PageHeader>

      <ErrorBanner message={error} />
      {!data || !t ? (!error && <Loading />) : (
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-6">
          <motion.div variants={stagger(0.05)} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Requests" value={t.requests} hint={`${data.today.requests} today · ${t.failed} failed`} />
            <Stat label="Tokens" value={tokens / scale} decimals={scale > 1 ? 1 : 0} suffix={unit}
              hint={`${compactNumber(t.input_tokens)} in · ${compactNumber(t.output_tokens)} out`} />
            <Stat label="Estimated cost" value={t.cost_usd} prefix="$" decimals={t.cost_usd >= 1 ? 2 : 4}
              hint={local ? 'local model, no charge' : 'at paid rates · free tier bills $0'} />
            <Stat label="Avg response" value={t.avg_seconds} decimals={1} suffix="s"
              hint={t.fallbacks ? `${t.fallbacks} answered by the backup model` : 'per successful request'} />
          </motion.div>

          {t.calls === 0 ? (
            <Panel>
              <Empty title="No AI requests in this period">
                Process a lead, email or document in the Studio, or ask FlowMancer a question, and it shows up here.
              </Empty>
            </Panel>
          ) : (
            <>
              <Panel eyebrow={RANGES.find((r) => r.value === range)?.label} title="Tokens per day">
                <div className="h-56" role="img" aria-label="Input and output tokens per day">
                  <TokenChart data={data.daily.map((d) => ({ ...d, label: dayLabel(d.date) }))} />
                </div>
              </Panel>

              <div className="grid gap-6 xl:grid-cols-2">
                <Panel eyebrow="By feature" title="Cost of each job" padded={false} className="p-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr><th className={th}>Feature</th><th className={th}>Items</th><th className={th}>Tokens / item</th><th className={th}>Cost / item</th><th className={th}>Total</th></tr></thead>
                      <tbody>
                        {data.by_feature.map((f) => {
                          const meta = FEATURES[f.feature];
                          const Icon = meta.icon;
                          return (
                            <tr key={f.feature} className="border-t border-white/[0.05]">
                              <td className={`${td} text-bone`}>
                                <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-blush" aria-hidden />{meta.label}</span>
                              </td>
                              <td className={`${td} text-bone/80`}>{f.feature === 'assistant' ? `${f.requests} req` : f.items}</td>
                              <td className={`${td} text-bone/80`}>{compactNumber(f.tokens_per_item)}</td>
                              <td className={`${td} text-bone/80`}>{f.unpriced_calls ? '-' : formatUsd(f.cost_per_item_usd)}</td>
                              <td className={`${td} font-medium text-bone`}>{formatUsd(f.cost_usd)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="px-3 pb-2 pt-3 text-xs text-fog">Crew mode runs four agents, so it uses several requests per item.</p>
                </Panel>

                <Panel eyebrow="By model" title="Who answered" padded={false} className="p-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr><th className={th}>Model</th><th className={th}>Requests</th><th className={th}>Avg</th><th className={th}>Price / 1M</th><th className={th}>Cost</th></tr></thead>
                      <tbody>
                        {data.by_model.map((m) => (
                          <tr key={`${m.provider}-${m.model}`} className="border-t border-white/[0.05]">
                            <td className={`${td} text-bone`}>
                              <span className="block font-mono text-[13px]">{m.model}</span>
                              <span className="block text-[11px] text-fog">{m.provider === 'ollama' ? 'Ollama (local)' : 'Gemini'}{m.failed ? ` · ${m.failed} failed` : ''}</span>
                            </td>
                            <td className={`${td} text-bone/80`}>{m.requests}</td>
                            <td className={`${td} text-bone/80`}>{m.avg_seconds === null ? '-' : `${m.avg_seconds.toFixed(1)}s`}</td>
                            <td className={`${td} text-[12px] text-fog`}>
                              {m.price_per_million ? (m.provider === 'ollama' ? 'free' : `$${m.price_per_million[0]} in · $${m.price_per_million[1]} out`) : 'not listed'}
                            </td>
                            <td className={`${td} font-medium text-bone`}>{m.price_per_million ? formatUsd(m.cost_usd) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>

              <Panel eyebrow="Latest" title="Recent requests" padded={false} className="p-3">
                <ul>
                  {data.recent.map((c) => {
                    const meta = FEATURES[c.feature];
                    const Icon = meta.icon;
                    return (
                      <li key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-white/[0.03] md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_110px_70px_auto]">
                        <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-blush">
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-bone">
                            {c.run_id ? <Link href={`/history/${c.run_id}`} className="hover:text-blush">{meta.label.replace(/s$/, '')} · run #{c.run_id}</Link> : meta.label}
                            {c.mode === 'crew' && <span className="text-fog"> · crew ({c.requests} req)</span>}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-fog">{timeAgo(c.created_at)}{c.error ? ` · ${c.error}` : ''}</span>
                        </span>
                        <span className="hidden min-w-0 truncate font-mono text-xs text-bone/80 md:block">
                          {c.model}{c.fallback && <Badge className="ml-2 border-amber/25 text-amber">backup</Badge>}
                        </span>
                        <span className="hidden font-mono text-xs tabular-nums text-fog md:block">
                          {compactNumber(c.input_tokens)} → {compactNumber(c.output_tokens)}
                        </span>
                        <span className="hidden font-mono text-xs tabular-nums text-fog md:block">{c.seconds === null ? '' : `${c.seconds.toFixed(1)}s`}</span>
                        <StatusBadge status={c.status} />
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            </>
          )}

          <Panel eyebrow="About these numbers" title="Where they come from">
            <ul className="space-y-2 text-sm leading-relaxed text-fog">
              <li>Token counts are the ones the model reports for each request. A failed or rate-limited request uses no tokens.</li>
              <li>
                The cost is an <span className="text-bone">estimate at Google&apos;s standard paid prices</span>
                {Object.entries(data.prices).filter(([, p]) => p).map(([m, p]) => ` · ${m}: $${p![0]} in / $${p![1]} out per 1M`).join('')}.
                {' '}On the free tier Google bills nothing, but limits requests per minute and per day.{' '}
                <a href={PRICING_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blush hover:underline">Prices <ExternalLink className="h-3 w-3" aria-hidden /></a>
                {' · '}
                <a href={LIMITS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blush hover:underline">Your limits <ExternalLink className="h-3 w-3" aria-hidden /></a>
              </li>
              <li>Days are counted in UTC. Only your account&apos;s requests are shown.</li>
            </ul>
          </Panel>
        </motion.div>
      )}
    </div>
  );
}
