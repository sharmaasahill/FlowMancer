'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, FileCheck, Mail, MessageSquare, Send, UserPlus, X } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Empty, ErrorBanner, Loading, PageHeader, Segmented, Spinner, StatusBadge } from '@/components/ui';
import { approvalsApi, errorMessage } from '@/lib/api';
import { useSystem } from '@/lib/system';
import type { Approval } from '@/types';
import { timeAgo } from '@/lib/utils';

const ACTIONS: Record<string, { label: string; icon: typeof Mail }> = {
  email_reply: { label: 'Reply by email (Gmail draft, or send)', icon: Mail },
  crm_contact: { label: 'Create or update HubSpot contact', icon: UserPlus },
  document_approval: { label: 'Approve document · notify Slack + webhook', icon: FileCheck },
  slack_message: { label: 'Post to Slack', icon: MessageSquare },
};

const EDITABLE: Record<string, { key: string; label: string; multiline?: boolean; wide?: boolean }[]> = {
  email_reply: [{ key: 'to', label: 'To' }, { key: 'subject', label: 'Subject' }, { key: 'body', label: 'Reply', multiline: true, wide: true }],
  crm_contact: [
    { key: 'firstname', label: 'First name' }, { key: 'lastname', label: 'Last name' },
    { key: 'email', label: 'Email' }, { key: 'company', label: 'Company' }, { key: 'phone', label: 'Phone' },
  ],
  document_approval: [{ key: 'summary', label: 'Summary', multiline: true, wide: true }],
  slack_message: [{ key: 'text', label: 'Message', multiline: true, wide: true }],
};

function resultSummary(a: Approval): string {
  const steps = a.result?.steps || [];
  return steps.map((s) => `${s.target}: ${s.status === 'skipped' ? 'skipped (not connected)' : s.detail}`).join(' · ');
}

function ApprovalCard({ approval, onDecided, selected, onToggle, canSend }: {
  approval: Approval; onDecided: (a: Approval) => void; selected: boolean; onToggle: () => void; canSend: boolean;
}) {
  const fields = EDITABLE[approval.action] || [];
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, String(approval.payload[f.key] ?? '')])));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'send' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const meta = ACTIONS[approval.action] || { label: approval.action, icon: Check };
  const Icon = meta.icon;
  const pending = approval.status === 'pending';
  const extra = Object.entries(approval.payload)
    .filter(([k, v]) => !fields.some((f) => f.key === k) && v !== null && v !== '' && k !== 'in_reply_to' && !(Array.isArray(v) && !v.length));

  const isReply = approval.action === 'email_reply';

  const decide = async (kind: 'approve' | 'send' | 'reject') => {
    if (kind === 'send' && !window.confirm(`Send this reply to ${values.to} now? It can't be unsent.`)) return;
    setBusy(kind);
    setError(null);
    try {
      const edits = Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== String(approval.payload[k] ?? '')));
      onDecided(kind === 'reject'
        ? await approvalsApi.reject(approval.id, note || undefined)
        : await approvalsApi.approve(approval.id, Object.keys(edits).length ? edits : undefined, note || undefined,
          kind === 'send' ? 'send' : 'draft'));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <motion.article layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.28 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="glass flex flex-col p-6" aria-label={approval.title}>
      <div className="flex items-start gap-4">
        {pending && (
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select: ${approval.title}`}
            className="mt-3.5 h-4 w-4 shrink-0 cursor-pointer accent-crimson-500" />
        )}
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-crimson-400/30 bg-crimson/20 text-blush">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-snug text-bone">{approval.title}</h2>
          <p className="mt-1 text-xs text-fog">
            {meta.label} · {timeAgo(approval.created_at)}
            {approval.run_id && <> · <Link className="text-blush hover:underline" href={`/history/${approval.run_id}`}>run #{approval.run_id}</Link></>}
          </p>
        </div>
        <StatusBadge status={approval.status} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `a${approval.id}-${f.key}`;
          return (
            <div key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
              <label htmlFor={id} className="mb-1 block text-xs text-fog">{f.label}</label>
              {f.multiline ? (
                <textarea id={id} rows={f.key === 'body' ? 7 : 3} disabled={!pending} value={values[f.key]}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="field resize-y disabled:opacity-70" />
              ) : (
                <input id={id} disabled={!pending} value={values[f.key]}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="field disabled:opacity-70" />
              )}
            </div>
          );
        })}
      </div>

      {extra.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm">
          {extra.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs capitalize text-fog">{k.replace(/_/g, ' ')}</dt>
              <dd className="truncate text-bone">{Array.isArray(v) ? v.join('; ') : String(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {pending ? (
        <div className="mt-5 space-y-3">
          <label htmlFor={`a${approval.id}-note`} className="sr-only">Note (optional)</label>
          <input id={`a${approval.id}-note`} value={note} onChange={(e) => setNote(e.target.value)} className="field" placeholder="Add a note (optional)" />
          <ErrorBanner message={error} />
          <div className="flex flex-wrap gap-2 [&>button]:whitespace-nowrap">
            <button type="button" onClick={() => decide('approve')} disabled={!!busy} className="btn-primary flex-1 !py-2.5">
              {busy === 'approve' ? <Spinner className="h-4 w-4 text-white" /> : <Check className="h-4 w-4" aria-hidden />}
              {isReply ? ' Save as draft' : ' Approve'}
            </button>
            {isReply && canSend && (
              <button type="button" onClick={() => decide('send')} disabled={!!busy} className="btn-ghost !px-5 !py-2.5"
                title="Approve and send the reply from your connected Gmail right away">
                {busy === 'send' ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" aria-hidden />} Send now
              </button>
            )}
            <button type="button" onClick={() => decide('reject')} disabled={!!busy} className="btn-ghost !px-5 !py-2.5">
              {busy === 'reject' ? <Spinner className="h-4 w-4" /> : <X className="h-4 w-4" aria-hidden />} Reject
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-4 text-sm">
          {approval.note && <p className="text-fog">Note: <span className="text-bone">{approval.note}</span></p>}
          {approval.result?.steps.map((s, i) => (
            <p key={i} className="flex items-center gap-2 text-bone/90"><StatusBadge status={s.status} /> {s.target}: {s.detail}</p>
          ))}
        </div>
      )}
    </motion.article>
  );
}

export default function ApprovalsPage() {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [items, setItems] = useState<Approval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<'approve' | 'reject' | null>(null);
  const toast = useToast();
  const { refresh, integrations } = useSystem();
  const canSend = !!integrations?.mailbox.configured;

  const load = useCallback(() => {
    approvalsApi.list(filter).then((a) => { setItems(a); setError(null); }).catch((e) => setError(errorMessage(e)));
  }, [filter]);

  useEffect(() => {
    setItems(null);
    setSelected(new Set());
    load();
  }, [load]);

  const toggle = (id: number) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  /** Approve (as drafts) or reject every selected proposal as written, one after another. */
  const decideSelected = async (kind: 'approve' | 'reject') => {
    setBulk(kind);
    const ids = Array.from(selected);
    const done: number[] = [];
    let failed = 0;
    for (const id of ids) {
      try {
        const a = kind === 'approve' ? await approvalsApi.approve(id) : await approvalsApi.reject(id);
        done.push(id);
        if (a.result?.status === 'error') failed += 1;
      } catch {
        failed += 1;
      }
    }
    setItems((prev) => (prev || []).filter((x) => !done.includes(x.id)));
    setSelected(new Set());
    setBulk(null);
    refresh();
    toast({
      tone: failed ? 'error' : 'success',
      title: `${kind === 'approve' ? 'Approved' : 'Rejected'} ${done.length} of ${ids.length}`,
      detail: failed ? `${failed} had a problem. Open them to see why.` : undefined,
    });
  };

  const onDecided = (a: Approval) => {
    setItems((prev) => (prev || []).filter((x) => x.id !== a.id));
    setSelected((prev) => { const next = new Set(prev); next.delete(a.id); return next; });
    refresh();
    if (a.status === 'rejected') toast({ tone: 'info', title: 'Rejected', detail: a.title });
    else toast({
      tone: a.result?.status === 'error' ? 'error' : 'success',
      title: a.result?.status === 'error' ? 'Approved, but an action failed' : 'Approved',
      detail: resultSummary(a),
    });
  };

  return (
    <div className="space-y-8 pt-4">
      <PageHeader eyebrow="Approvals" title="Nothing leaves" accent="without you."
        subtitle="The AI proposes replies, CRM contacts and document sign-offs. Edit anything, then approve or reject. Replies are saved as Gmail drafts, or sent if you choose Send now." />
      <Segmented id="approvals" label="Filter approvals" value={filter} onChange={setFilter}
        options={[{ value: 'pending', label: 'Waiting' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
      <ErrorBanner message={error} />
      {filter === 'pending' && !!items?.length && (
        <div className="glass flex flex-wrap items-center gap-3 px-5 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-bone">
            <input type="checkbox" className="h-4 w-4 accent-crimson-500"
              checked={selected.size === items.length} onChange={() => setSelected(
                selected.size === items.length ? new Set() : new Set(items.map((a) => a.id)))} />
            Select all
          </label>
          <span className="text-xs text-fog">
            {selected.size ? `${selected.size} selected. Each runs as written; replies are saved as drafts.` : 'Tick several to decide them at once.'}
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => decideSelected('approve')} disabled={!selected.size || !!bulk} className="btn-primary !py-2">
              {bulk === 'approve' ? <Spinner className="h-4 w-4 text-white" /> : <Check className="h-4 w-4" aria-hidden />}
              Approve selected
            </button>
            <button type="button" onClick={() => decideSelected('reject')} disabled={!selected.size || !!bulk} className="btn-ghost !py-2">
              {bulk === 'reject' ? <Spinner className="h-4 w-4" /> : <X className="h-4 w-4" aria-hidden />}Reject selected
            </button>
          </div>
        </div>
      )}
      {items === null ? <Loading /> : items.length === 0 ? (
        <div className="glass"><Empty title={filter === 'pending' ? 'All caught up' : `Nothing ${filter} yet`}>
          {filter === 'pending' ? 'New proposals appear here as leads, emails and documents are processed.' : undefined}
        </Empty></div>
      ) : (
        <motion.div layout className="grid gap-5 xl:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {items.map((a) => (
              <ApprovalCard key={a.id} approval={a} onDecided={onDecided} canSend={canSend}
                selected={selected.has(a.id)} onToggle={() => toggle(a.id)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
