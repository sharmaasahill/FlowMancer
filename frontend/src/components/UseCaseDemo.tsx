'use client';

import { useEffect, useState } from 'react';
import { FileText, Mail, Upload, Users } from 'lucide-react';
import { errorMessage, runsApi } from '@/lib/api';
import { useRunStream } from '@/lib/useRunStream';
import type { Approval, Kind, Mode } from '@/types';
import RunSteps from '@/components/RunSteps';
import RunResult from '@/components/RunResult';
import { Card, ErrorBanner, Field, PageHeader, StatusBadge, buttonClass, inputClass } from '@/components/ui';
import { cn } from '@/lib/utils';

const TABS: { id: Kind; label: string; icon: typeof Users }[] = [
  { id: 'lead', label: 'Lead Qualification', icon: Users },
  { id: 'email', label: 'Email Processing', icon: Mail },
  { id: 'document', label: 'Document Processing', icon: FileText },
];

function ModePicker({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium text-gray-700">Processing mode</legend>
      <div className="grid grid-cols-2 gap-2">
        {([
          ['quick', 'Quick', 'One AI call, seconds'],
          ['crew', 'Crew', '4 specialist agents, minutes'],
        ] as const).map(([value, label, hint]) => (
          <label key={value} className={cn(
            'cursor-pointer rounded-lg border p-3 text-sm focus-within:ring-2 focus-within:ring-blue-500',
            mode === value ? 'border-blue-600 bg-blue-50' : 'border-gray-300',
          )}>
            <input type="radio" name="mode" value={value} checked={mode === value}
              onChange={() => setMode(value)} className="sr-only" />
            <span className="block font-semibold">{label}</span>
            <span className="text-xs text-gray-600">{hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function UseCaseDemo() {
  const [tab, setTab] = useState<Kind>('lead');
  const [mode, setMode] = useState<Mode>('quick');
  const [docSource, setDocSource] = useState<'paste' | 'upload'>('paste');
  const [runId, setRunId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const { run, error: streamError } = useRunStream(runId);

  const busy = submitting || (!!run && (run.status === 'queued' || run.status === 'running'));

  useEffect(() => {
    if (run?.status === 'completed') runsApi.approvals(run.id).then(setApprovals).catch(() => setApprovals([]));
    else setApprovals([]);
  }, [run?.status, run?.id]);

  const start = async (fn: () => Promise<{ id: number }>) => {
    setSubmitting(true);
    setSubmitError(null);
    setRunId(null);
    try {
      setRunId((await fn()).id);
    } catch (e) {
      setSubmitError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => ((f.get(k) as string) || '').trim() || undefined;

    if (tab === 'lead') {
      start(() => runsApi.startJob('lead', {
        name: get('name'), email: get('email'), company: get('company'),
        phone: get('phone'), message: get('message'), source: 'website',
      }, mode));
    } else if (tab === 'email') {
      start(() => runsApi.startJob('email', { from_email: get('from_email'), subject: get('subject') || '', body: get('body') || '' }, mode));
    } else if (docSource === 'upload') {
      const file = f.get('file') as File | null;
      if (!file || !file.size) {
        setSubmitError('Choose a file to upload.');
        return;
      }
      start(() => runsApi.uploadDocument(file, get('document_type') || 'auto', mode));
    } else {
      start(() => runsApi.startJob('document', { document_type: get('document_type') || 'auto', file_content: get('file_content') }, mode));
    }
  };

  const submitLabel = { lead: 'Qualify lead', email: 'Process email', document: 'Process document' }[tab];

  return (
    <div className="space-y-6">
      <PageHeader title="Try it" subtitle="Run a lead, email or document through the AI and watch each step live" />

      <div role="tablist" aria-label="Use case" className="flex flex-wrap gap-2 border-b">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id}
            onClick={() => { setTab(id); setRunId(null); setSubmitError(null); }}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900',
            )}>
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Input">
          <form onSubmit={onSubmit} className="space-y-4" key={tab}>
            {tab === 'lead' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Name" htmlFor="name"><input id="name" name="name" required className={inputClass} placeholder="John Doe" /></Field>
                  <Field label="Email" htmlFor="email" hint="A company email lets FlowMancer research the company">
                    <input id="email" name="email" type="email" required className={inputClass} placeholder="john@company.com" />
                  </Field>
                  <Field label="Company" htmlFor="company"><input id="company" name="company" className={inputClass} placeholder="Acme Corp" /></Field>
                  <Field label="Phone" htmlFor="phone"><input id="phone" name="phone" type="tel" className={inputClass} /></Field>
                </div>
                <Field label="Message" htmlFor="message">
                  <textarea id="message" name="message" rows={3} className={inputClass} placeholder="Need an enterprise plan for 500 users, budget approved" />
                </Field>
              </>
            )}

            {tab === 'email' && (
              <>
                <Field label="From" htmlFor="from_email"><input id="from_email" name="from_email" type="email" required className={inputClass} placeholder="customer@example.com" /></Field>
                <Field label="Subject" htmlFor="subject"><input id="subject" name="subject" required className={inputClass} placeholder="Can I get a refund?" /></Field>
                <Field label="Body" htmlFor="body" hint="Replies use your Knowledge base for policies and facts">
                  <textarea id="body" name="body" rows={6} required className={inputClass} />
                </Field>
              </>
            )}

            {tab === 'document' && (
              <>
                <Field label="Document type" htmlFor="document_type">
                  <select id="document_type" name="document_type" className={inputClass} defaultValue="auto">
                    <option value="auto">Detect automatically</option>
                    <option value="invoice">Invoice</option>
                    <option value="contract">Contract</option>
                    <option value="receipt">Receipt</option>
                    <option value="purchase_order">Purchase order</option>
                  </select>
                </Field>
                <fieldset>
                  <legend className="mb-1 text-sm font-medium text-gray-700">Source</legend>
                  <div className="flex gap-4 text-sm">
                    {(['paste', 'upload'] as const).map((s) => (
                      <label key={s} className="flex items-center gap-2">
                        <input type="radio" name="doc_source" checked={docSource === s} onChange={() => setDocSource(s)} />
                        {s === 'paste' ? 'Paste text' : 'Upload file'}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {docSource === 'paste' ? (
                  <Field label="Document text" htmlFor="file_content">
                    <textarea id="file_content" name="file_content" rows={8} required className={inputClass}
                      placeholder="Invoice #123, Acme Ltd, Total $1,200, due 2026-11-01" />
                  </Field>
                ) : (
                  <Field label="File" htmlFor="file" hint="PDF (with real text, not a scan), TXT, MD, CSV or HTML. Max 10 MB.">
                    <input id="file" name="file" type="file" required accept=".pdf,.txt,.md,.csv,.html,.htm,.json"
                      className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700" />
                  </Field>
                )}
              </>
            )}

            <ModePicker mode={mode} setMode={setMode} />
            <ErrorBanner message={submitError} />
            <button type="submit" disabled={busy} className={cn(buttonClass.primary, 'w-full py-3')}>
              {tab === 'document' && docSource === 'upload' && <Upload className="h-4 w-4" aria-hidden />}
              {busy ? 'Working...' : submitLabel}
            </button>
          </form>
        </Card>

        <Card title="Result" actions={run && <StatusBadge status={run.status} />}>
          <div aria-live="polite">
            {!run && !submitting && <p className="py-16 text-center text-sm text-gray-500">Submit the form to see each step as it happens.</p>}
            {submitting && <p className="py-16 text-center text-sm text-gray-500">Starting...</p>}
            <ErrorBanner message={streamError} />
            {run && (
              <div className="space-y-6">
                {run.steps && <RunSteps steps={run.steps} startedAt={run.created_at} />}
                {run.mode === 'crew' && run.status === 'running' && (
                  <p className="text-xs text-gray-500">Crew mode on a local model usually takes 5-10 minutes. You can leave this page; the result will be in History.</p>
                )}
                {(run.status === 'completed' || run.status === 'failed') && <RunResult run={run} approvals={approvals} />}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
