'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Check, Copy, Globe, Zap } from 'lucide-react';
import type { ActionResult, Approval, DocumentResult, EmailResult, LeadResult, Run } from '@/types';
import { Badge, rise, ScoreRing, stagger, StatusBadge } from '@/components/ui';
import { cn, hostname, LEVEL_TONES } from '@/lib/utils';

function Level({ value }: { value: string }) {
  return <Badge className={LEVEL_TONES[value] || LEVEL_TONES.low}>{value.replace('_', ' ')}</Badge>;
}

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <motion.div variants={rise}>
      <p className="eyebrow mb-3 flex items-center gap-2 !text-[10px]">{Icon && <Icon className="h-3.5 w-3.5" />}{title}</p>
      {children}
    </motion.div>
  );
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== '');
  return (
    <motion.dl variants={rise} className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {shown.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-fog">{k}</dt>
          <dd className="mt-0.5 break-words text-sm text-bone">{v}</dd>
        </div>
      ))}
    </motion.dl>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((x, i) => (
        <li key={i} className="flex gap-3 text-sm text-bone/90">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-crimson-400" aria-hidden />{x}
        </li>
      ))}
    </ul>
  );
}

const BREAKDOWN: { key: keyof LeadResult['score_breakdown']; label: string; max: number }[] = [
  { key: 'company_size', label: 'Company size', max: 25 },
  { key: 'industry_fit', label: 'Industry fit', max: 20 },
  { key: 'budget', label: 'Budget', max: 20 },
  { key: 'urgency', label: 'Urgency', max: 15 },
  { key: 'decision_maker', label: 'Decision maker', max: 10 },
  { key: 'intent', label: 'Intent', max: 10 },
];

function LeadView({ o }: { o: LeadResult }) {
  return (
    <>
      <motion.div variants={rise} className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <ScoreRing score={o.lead_score} />
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap gap-2"><Level value={o.qualification} /><Level value={o.priority} /></div>
          <p className="font-display text-2xl leading-snug text-bone">{o.assigned_to}</p>
          <p className="text-sm leading-relaxed text-fog">{o.recommended_action}</p>
        </div>
      </motion.div>
      {o.score_breakdown && (
        <Section title="How the score adds up">
          <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {BREAKDOWN.map(({ key, label, max }, i) => {
              const v = o.score_breakdown[key] || 0;
              return (
                <li key={key}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-fog">{label}</span><span className="font-mono tabular-nums text-bone">{v}/{max}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-crimson-700 to-crimson-400"
                      initial={{ width: 0 }} animate={{ width: `${(v / max) * 100}%` }} transition={{ delay: 0.15 + i * 0.07, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
      <Section title="Why"><p className="text-sm leading-relaxed text-bone/90">{o.reasoning}</p></Section>
      {o.company_summary && <Section title="The company"><p className="text-sm leading-relaxed text-bone/90">{o.company_summary}</p></Section>}
      {!!o.talking_points?.length && <Section title="Talking points"><Bullets items={o.talking_points} /></Section>}
    </>
  );
}

function EmailView({ o }: { o: EmailResult }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(o.draft_reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <>
      <motion.div variants={rise} className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge className="border-white/15 bg-white/[0.06] text-bone">{o.category}</Badge>
          <Level value={o.priority} /><Level value={o.sentiment} />
        </div>
        <p className="font-display text-2xl leading-snug text-bone">{o.summary}</p>
      </motion.div>
      <Facts rows={[['Team', o.assigned_team], ['Action needed', o.action_required ? 'Yes' : 'No'], ['Tags', o.tags?.join(', ')]]} />
      {o.draft_reply ? (
        <Section title="Draft reply">
          <div className="relative rounded-2xl border border-white/[0.07] bg-noir-950/50 p-5">
            <button type="button" onClick={copy} className="btn-quiet absolute right-2 top-2 !px-2.5 !py-1.5 text-xs"
              aria-label="Copy reply">
              {copied ? <Check className="h-3.5 w-3.5 text-jade" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}
            </button>
            <p className="whitespace-pre-wrap pr-16 text-sm leading-relaxed text-bone/90">{o.draft_reply}</p>
          </div>
        </Section>
      ) : (
        <motion.p variants={rise} className="text-sm text-fog">No reply drafted{o.category === 'spam' ? ' for spam' : ''}.</motion.p>
      )}
    </>
  );
}

function DocumentView({ o }: { o: DocumentResult }) {
  const money = (n: number | null | undefined) => (n === null || n === undefined ? null : `${n.toLocaleString()} ${o.currency || ''}`.trim());
  return (
    <>
      <motion.div variants={rise} className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge className="border-white/15 bg-white/[0.06] text-bone">{o.document_type.replace('_', ' ')}</Badge>
            <Level value={o.validation_status} />
            {o.approval_required
              ? <Badge className="border-crimson-400/40 bg-crimson/20 text-blush">needs {o.approver} approval</Badge>
              : <Badge className="border-jade/25 bg-jade/[0.08] text-jade">no approval needed</Badge>}
          </div>
          <p className="font-display text-2xl leading-snug text-bone">{o.counterparty || 'Unknown issuer'}</p>
          <p className="text-sm text-fog">{o.summary}</p>
        </div>
        {o.total_amount !== null && (
          <div className="text-right">
            <p className="eyebrow !text-[10px]">Total</p>
            <p className="font-display text-5xl leading-none text-bone">{o.total_amount.toLocaleString()}</p>
            <p className="mt-1 font-mono text-xs text-fog">{o.currency}</p>
          </div>
        )}
      </motion.div>
      {!!o.issues?.length && (
        <motion.div variants={rise} className="rounded-2xl border border-coral/25 bg-coral/[0.06] p-4">
          <p className="eyebrow mb-2 !text-[10px] !text-coral">Problems found</p>
          <Bullets items={o.issues} />
        </motion.div>
      )}
      <Facts rows={[['Number', o.document_number], ['Issued', o.issue_date], ['Due', o.due_date], ['Tax', money(o.tax_amount)],
        ...(o.fields || []).map((f) => [f.name, f.value] as [string, string])]} />
      {!!o.line_items?.length && (
        <Section title="Line items">
          <table className="w-full text-sm">
            <caption className="sr-only">Line items</caption>
            <tbody className="divide-y divide-white/[0.06]">
              {o.line_items.map((li, i) => (
                <tr key={i}><td className="py-2 text-bone/90">{li.description}</td><td className="py-2 text-right font-mono tabular-nums text-bone">{li.amount.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      {!!o.ai_notes?.length && <Section title="AI notes"><Bullets items={o.ai_notes} /></Section>}
      {!!o.next_steps?.length && <Section title="Next steps"><Bullets items={o.next_steps} /></Section>}
    </>
  );
}

function Actions({ actions }: { actions: ActionResult[] }) {
  return (
    <ul className="space-y-2">
      {actions.map((a, i) => (
        <li key={i} className="flex items-center gap-2 text-sm text-bone/90"><StatusBadge status={a.status} />{a.reason ? `${a.reason}: ` : ''}{a.detail}</li>
      ))}
    </ul>
  );
}

export default function RunResult({ run, approvals }: { run: Run; approvals?: Approval[] }) {
  if (run.status === 'failed') {
    return (
      <div role="alert" className="rounded-2xl border border-coral/25 bg-coral/[0.06] p-5">
        <p className="font-semibold text-coral">Processing failed</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-bone/85">{run.error}</p>
      </div>
    );
  }
  if (!run.output) return null;
  const o = run.output as any;

  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="space-y-7">
      {run.kind === 'lead' && <LeadView o={o} />}
      {run.kind === 'email' && <EmailView o={o} />}
      {run.kind === 'document' && <DocumentView o={o} />}

      {!!run.research?.length && (
        <Section title={`Sources (${run.research.length})`} icon={Globe}>
          <ol className="grid gap-2 sm:grid-cols-2">
            {run.research.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="group block h-full rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition hover:border-blush/30 hover:bg-white/[0.04]">
                  <p className="flex items-center gap-2 font-mono text-[11px] text-blush">
                    <span className="grid h-4 w-4 place-items-center rounded bg-crimson/30 text-[9px] text-white">{i + 1}</span>
                    {hostname(s.url)}<span className="sr-only">(opens in new tab)</span>
                  </p>
                  <p className="mt-1.5 line-clamp-1 text-sm font-medium text-bone">{s.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-fog">{s.snippet}</p>
                </a>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {!!run.knowledge?.length && (
        <Section title="Knowledge used" icon={BookOpen}>
          <ul className="space-y-2">
            {run.knowledge.map((k, i) => (
              <li key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <p className="font-mono text-[11px] text-blush">{k.doc_name}</p>
                <p className="mt-1 line-clamp-3 text-sm text-fog">{k.text}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!!run.actions?.length && <Section title="Automatic actions" icon={Zap}><Actions actions={run.actions} /></Section>}

      {!!approvals?.length && (
        <motion.div variants={rise} className="space-y-2">
          {approvals.map((a) => (
            <div key={a.id} className={cn('flex items-center gap-3 rounded-2xl border p-4',
              a.status === 'pending' ? 'border-crimson-400/30 bg-crimson/[0.1]' : 'border-white/[0.07] bg-white/[0.02]')}>
              <StatusBadge status={a.status} />
              <span className="min-w-0 flex-1 truncate text-sm text-bone">{a.title}</span>
              {a.status === 'pending' && (
                <Link href="/approvals" className="inline-flex items-center gap-1 text-sm font-semibold text-blush">Review <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              )}
            </div>
          ))}
        </motion.div>
      )}

      {run.raw_text && (
        <motion.details variants={rise} className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm">
          <summary className="cursor-pointer font-medium text-bone">Full agent conversation</summary>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-fog">{run.raw_text}</pre>
        </motion.details>
      )}
    </motion.div>
  );
}
