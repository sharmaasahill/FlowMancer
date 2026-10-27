'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { approvalsApi, errorMessage } from '@/lib/api';
import type { Approval } from '@/types';
import { Card, Empty, ErrorBanner, PageHeader, Spinner, StatusBadge, buttonClass, inputClass } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';

const ACTION_LABELS: Record<string, string> = {
  email_reply: 'Save reply as mailbox draft',
  crm_contact: 'Create/update HubSpot contact',
  document_approval: 'Approve document (notifies Slack + webhook)',
  slack_message: 'Post to Slack',
};

/** Fields shown for editing per action. Others are shown read-only. */
const EDITABLE: Record<string, { key: string; label: string; multiline?: boolean }[]> = {
  email_reply: [{ key: 'to', label: 'To' }, { key: 'subject', label: 'Subject' }, { key: 'body', label: 'Reply', multiline: true }],
  crm_contact: [
    { key: 'email', label: 'Email' }, { key: 'firstname', label: 'First name' }, { key: 'lastname', label: 'Last name' },
    { key: 'company', label: 'Company' }, { key: 'phone', label: 'Phone' },
  ],
  document_approval: [{ key: 'summary', label: 'Summary', multiline: true }],
  slack_message: [{ key: 'text', label: 'Message', multiline: true }],
};

function ApprovalCard({ approval, onDone }: { approval: Approval; onDone: (a: Approval) => void }) {
  const fields = EDITABLE[approval.action] || [];
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, String(approval.payload[f.key] ?? '')])),
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readOnly = Object.entries(approval.payload).filter(([k, v]) => !fields.some((f) => f.key === k) && v !== null && v !== '' && k !== 'in_reply_to');

  const decide = async (kind: 'approve' | 'reject') => {
    setBusy(kind);
    setError(null);
    try {
      const edits = Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== String(approval.payload[k] ?? '')));
      onDone(kind === 'approve'
        ? await approvalsApi.approve(approval.id, Object.keys(edits).length ? edits : undefined, note || undefined)
        : await approvalsApi.reject(approval.id, note || undefined));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const pending = approval.status === 'pending';
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">{approval.title}</h2>
          <p className="text-xs text-gray-500">
            {ACTION_LABELS[approval.action]} - {formatDate(approval.created_at)}
            {approval.run_id && <> - <Link className="text-blue-700 hover:underline" href={`/history/${approval.run_id}`}>run #{approval.run_id}</Link></>}
          </p>
        </div>
        <StatusBadge status={approval.status} />
      </div>

      <div className="space-y-3">
        {fields.map((f) => {
          const id = `a${approval.id}-${f.key}`;
          return (
            <div key={f.key}>
              <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-600">{f.label}</label>
              {f.multiline ? (
                <textarea id={id} rows={f.key === 'body' ? 7 : 3} disabled={!pending} value={values[f.key]}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className={inputClass} />
              ) : (
                <input id={id} disabled={!pending} value={values[f.key]}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className={inputClass} />
              )}
            </div>
          );
        })}
        {readOnly.length > 0 && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-md bg-gray-50 p-3 text-sm sm:grid-cols-2">
            {readOnly.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-gray-500">{k.replace('_', ' ')}:</dt>
                <dd className="text-gray-900">{Array.isArray(v) ? v.join('; ') || '-' : String(v)}</dd>
              </div>
            ))}
          </dl>
        )}

        {pending ? (
          <>
            <div>
              <label htmlFor={`a${approval.id}-note`} className="mb-1 block text-xs font-medium text-gray-600">Note (optional)</label>
              <input id={`a${approval.id}-note`} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </div>
            <ErrorBanner message={error} />
            <div className="flex gap-2">
              <button type="button" onClick={() => decide('approve')} disabled={!!busy} className={buttonClass.success}>
                {busy === 'approve' ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" aria-hidden />} Approve
              </button>
              <button type="button" onClick={() => decide('reject')} disabled={!!busy} className={buttonClass.danger}>
                {busy === 'reject' ? <Spinner className="h-4 w-4" /> : <X className="h-4 w-4" aria-hidden />} Reject
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-1 text-sm">
            {approval.note && <p className="text-gray-600">Note: {approval.note}</p>}
            {approval.result?.steps.map((s, i) => (
              <p key={i} className="flex items-center gap-2"><StatusBadge status={s.status} /> {s.target}: {s.detail}</p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ApprovalsPage() {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [items, setItems] = useState<Approval[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    approvalsApi.list(filter).then((a) => { setItems(a); setError(null); }).catch((e) => setError(errorMessage(e)));
  }, [filter]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title="Approvals" subtitle="Nothing is sent or saved until a person approves it. Edit anything before approving." />
      <div role="tablist" aria-label="Filter approvals" className="flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map((f) => (
          <button key={f} role="tab" type="button" aria-selected={filter === f} onClick={() => setFilter(f)}
            className={cn('rounded-full px-4 py-1.5 text-sm font-semibold capitalize',
              filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50')}>
            {f}
          </button>
        ))}
      </div>
      <ErrorBanner message={error} />
      {items === null ? <div className="flex justify-center py-12"><Spinner className="h-8 w-8 text-blue-600" /></div>
        : items.length === 0 ? <Card><Empty>No {filter} approvals.</Empty></Card>
        : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {items.map((a) => (
              <ApprovalCard key={a.id} approval={a}
                onDone={(updated) => setItems((prev) => (prev || []).map((x) => (x.id === updated.id ? updated : x)))} />
            ))}
          </div>
        )}
    </div>
  );
}
