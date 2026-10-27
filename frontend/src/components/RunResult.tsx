'use client';

import Link from 'next/link';
import { BookOpen, ExternalLink, Globe } from 'lucide-react';
import type { ActionResult, Approval, DocumentResult, EmailResult, LeadResult, Run } from '@/types';
import { Badge, StatusBadge } from '@/components/ui';
import { LEVEL_STYLES } from '@/lib/utils';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="col-span-2 text-gray-900">{children || <span className="text-gray-400">-</span>}</dd>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (!items?.length) return <span className="text-gray-400">-</span>;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((x, i) => <li key={i}>{x}</li>)}
    </ul>
  );
}

function Level({ value }: { value: string }) {
  return <Badge className={LEVEL_STYLES[value] || 'bg-gray-100 text-gray-700'}>{value.replace('_', ' ')}</Badge>;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-gray-400';
  return (
    <div className="flex items-center gap-3">
      <span className="text-3xl font-bold tabular-nums">{score}</span>
      <div className="h-2 flex-1 rounded-full bg-gray-200" role="meter" aria-valuenow={score} aria-valuemin={0}
        aria-valuemax={100} aria-label="Lead score">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
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

function Breakdown({ b }: { b: LeadResult['score_breakdown'] }) {
  return (
    <table className="w-full text-xs">
      <caption className="sr-only">Score breakdown</caption>
      <tbody>
        {BREAKDOWN.map(({ key, label, max }) => (
          <tr key={key}>
            <th scope="row" className="w-32 py-0.5 text-left font-normal text-gray-600">{label}</th>
            <td className="py-0.5">
              <div className="h-1.5 rounded-full bg-gray-200" aria-hidden>
                <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${((b[key] || 0) / max) * 100}%` }} />
              </div>
            </td>
            <td className="w-14 py-0.5 text-right tabular-nums text-gray-700">{b[key] || 0}/{max}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LeadView({ o }: { o: LeadResult }) {
  return (
    <div className="space-y-4">
      <ScoreBar score={o.lead_score} />
      {o.score_breakdown && <Breakdown b={o.score_breakdown} />}
      <dl className="divide-y divide-gray-100">
        <Row label="Level"><Level value={o.qualification} /></Row>
        <Row label="Priority"><Level value={o.priority} /></Row>
        <Row label="Owner">{o.assigned_to}</Row>
        <Row label="Next step">{o.recommended_action}</Row>
        <Row label="Why">{o.reasoning}</Row>
        <Row label="Company">{o.company_summary}</Row>
        <Row label="Talking points"><List items={o.talking_points} /></Row>
      </dl>
    </div>
  );
}

function EmailView({ o }: { o: EmailResult }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge className="bg-blue-100 text-blue-800">{o.category}</Badge>
        <Level value={o.priority} />
        <Level value={o.sentiment} />
      </div>
      <dl className="divide-y divide-gray-100">
        <Row label="Summary">{o.summary}</Row>
        <Row label="Team">{o.assigned_team}</Row>
        <Row label="Action needed">{o.action_required ? 'Yes' : 'No'}</Row>
        <Row label="Tags">{o.tags?.join(', ')}</Row>
      </dl>
      {o.draft_reply && (
        <div>
          <h4 className="mb-1 text-sm font-semibold text-gray-700">Draft reply</h4>
          <p className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-800">{o.draft_reply}</p>
        </div>
      )}
    </div>
  );
}

function DocumentView({ o }: { o: DocumentResult }) {
  const amount = o.total_amount !== null && o.total_amount !== undefined
    ? `${o.total_amount.toLocaleString()} ${o.currency || ''}` : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge className="bg-blue-100 text-blue-800">{o.document_type.replace('_', ' ')}</Badge>
        <Level value={o.validation_status} />
        {o.approval_required
          ? <Badge className="bg-orange-100 text-orange-800">needs approval: {o.approver}</Badge>
          : <Badge className="bg-green-100 text-green-800">no approval needed</Badge>}
      </div>
      <dl className="divide-y divide-gray-100">
        <Row label="Summary">{o.summary}</Row>
        <Row label="Issued by">{o.counterparty}</Row>
        <Row label="Number">{o.document_number}</Row>
        <Row label="Issued">{o.issue_date}</Row>
        <Row label="Due">{o.due_date}</Row>
        {o.tax_amount !== null && o.tax_amount !== undefined && <Row label="Tax">{o.tax_amount.toLocaleString()}</Row>}
        <Row label="Total">{amount}</Row>
        {o.fields?.map((f, i) => <Row key={i} label={f.name}>{f.value}</Row>)}
        <Row label="Issues"><List items={o.issues} /></Row>
        {!!o.ai_notes?.length && <Row label="AI notes"><List items={o.ai_notes} /></Row>}
        <Row label="Next steps"><List items={o.next_steps} /></Row>
      </dl>
      {!!o.line_items?.length && (
        <table className="w-full text-sm">
          <caption className="mb-1 text-left text-sm font-semibold text-gray-700">Line items</caption>
          <thead className="text-left text-xs text-gray-500">
            <tr><th scope="col" className="py-1">Description</th><th scope="col" className="py-1 text-right">Amount</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {o.line_items.map((li, i) => (
              <tr key={i}><td className="py-1">{li.description}</td><td className="py-1 text-right tabular-nums">{li.amount.toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ActionsList({ actions }: { actions: ActionResult[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {actions.map((a, i) => (
        <li key={i} className="flex items-center gap-2">
          <StatusBadge status={a.status} />
          <span>{a.reason ? `${a.reason}: ` : ''}{a.detail}</span>
        </li>
      ))}
    </ul>
  );
}

export default function RunResult({ run, approvals }: { run: Run; approvals?: Approval[] }) {
  if (run.status === 'failed') {
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">Processing failed</p>
        <p className="mt-1 whitespace-pre-wrap">{run.error}</p>
      </div>
    );
  }
  if (!run.output) return null;
  const o = run.output as any;

  return (
    <div className="space-y-6">
      {run.kind === 'lead' && <LeadView o={o} />}
      {run.kind === 'email' && <EmailView o={o} />}
      {run.kind === 'document' && <DocumentView o={o} />}

      {!!run.research?.length && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Globe className="h-4 w-4" aria-hidden /> Research sources
          </h4>
          <ol className="space-y-2 text-sm">
            {run.research.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
                  [{i + 1}] {s.title || s.url} <ExternalLink className="h-3 w-3" aria-hidden />
                  <span className="sr-only">(opens in new tab)</span>
                </a>
                <p className="line-clamp-2 text-gray-600">{s.snippet}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!!run.knowledge?.length && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <BookOpen className="h-4 w-4" aria-hidden /> Knowledge used
          </h4>
          <ul className="space-y-2 text-sm">
            {run.knowledge.map((k, i) => (
              <li key={i} className="rounded-md bg-gray-50 p-2">
                <p className="text-xs font-semibold text-gray-600">{k.doc_name}</p>
                <p className="line-clamp-3 text-gray-700">{k.text}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!run.actions?.length && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-700">Automatic actions</h4>
          <ActionsList actions={run.actions} />
        </div>
      )}

      {!!approvals?.length && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
          {approvals.map((a) => (
            <p key={a.id} className="flex items-center gap-2">
              <StatusBadge status={a.status} />
              <span className="flex-1">{a.title}</span>
              {a.status === 'pending' && <Link href="/approvals" className="font-semibold text-blue-700 hover:underline">Review</Link>}
            </p>
          ))}
        </div>
      )}

      {run.raw_text && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-gray-700">Full agent conversation</summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs">{run.raw_text}</pre>
        </details>
      )}

      {run.ai_model && <p className="border-t pt-2 text-center text-xs text-gray-500">Powered by {run.ai_model}</p>}
    </div>
  );
}
