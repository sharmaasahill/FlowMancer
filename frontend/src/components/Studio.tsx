'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, FileText, FileUp, Mail, Sparkles, Users, Wand2 } from 'lucide-react';
import Orb, { type OrbState } from '@/components/Orb';
import RunResult from '@/components/RunResult';
import RunSteps from '@/components/RunSteps';
import { ErrorBanner, Field, PageHeader, Panel, Segmented, stagger, StatusBadge } from '@/components/ui';
import { errorMessage, runsApi } from '@/lib/api';
import { EMPTY_VALUES, EXAMPLES } from '@/lib/examples';
import { useSystem } from '@/lib/system';
import { useRunStream } from '@/lib/useRunStream';
import type { Approval, Kind, Mode } from '@/types';
import { cn, elapsedSince, formatDuration } from '@/lib/utils';

const KINDS: { value: Kind; label: string; icon: typeof Users }[] = [
  { value: 'lead', label: 'Lead', icon: Users },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'document', label: 'Document', icon: FileText },
];

const MODES: { value: Mode; title: string; hint: string }[] = [
  { value: 'quick', title: 'Quick', hint: 'One focused AI pass. A few seconds.' },
  { value: 'crew', title: 'Crew', hint: 'Four specialist agents, one after another.' },
];

function ModePicker({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-medium text-bone/85">How should it think?</legend>
      <div className="grid grid-cols-2 gap-2">
        {MODES.map((m) => {
          const active = mode === m.value;
          return (
            <label key={m.value} className={cn('relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition focus-within:ring-2 focus-within:ring-blush/60',
              active ? 'border-crimson-400/50' : 'border-white/[0.07] hover:border-white/[0.14]')}>
              {active && <motion.span layoutId="mode-pick" className="absolute inset-0 bg-gradient-to-br from-crimson/35 to-crimson/5"
                transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <input type="radio" name="mode" value={m.value} checked={active} onChange={() => setMode(m.value)} className="sr-only" />
              <span className="relative flex items-center gap-2 font-semibold text-bone">
                {m.value === 'crew' ? <Users className="h-4 w-4 text-blush" aria-hidden /> : <Sparkles className="h-4 w-4 text-blush" aria-hidden />}
                {m.title}
              </span>
              <span className="relative mt-1 block text-xs leading-relaxed text-fog">{m.hint}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Dropzone({ file, setFile }: { file: File | null; setFile: (f: File | null) => void }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); setFile(e.dataTransfer.files?.[0] || null); }}
      className={cn('relative grid place-items-center rounded-2xl border border-dashed px-6 py-10 text-center transition',
        over ? 'border-blush bg-crimson/10' : 'border-white/15 bg-noir-950/40 hover:border-white/25')}>
      <FileUp className={cn('h-8 w-8 transition', over ? 'text-blush' : 'text-fog')} aria-hidden />
      <p className="mt-3 text-sm text-bone">{file ? file.name : 'Drop a PDF, TXT, MD, CSV or HTML file'}</p>
      <p className="mt-1 text-xs text-fog">{file ? `${(file.size / 1024).toFixed(0)} KB` : 'Text-based PDFs only (no scans). Max 10 MB.'}</p>
      <button type="button" onClick={() => input.current?.click()} className="btn-ghost mt-4 !py-1.5 text-xs">
        {file ? 'Choose another' : 'Browse files'}
      </button>
      <input ref={input} type="file" accept=".pdf,.txt,.md,.csv,.html,.htm,.json" className="sr-only" aria-label="Document file"
        onChange={(e) => setFile(e.target.files?.[0] || null)} />
    </div>
  );
}

export default function Studio() {
  const params = useSearchParams();
  const router = useRouter();
  const initialKind = (KINDS.some((k) => k.value === params.get('kind')) ? params.get('kind') : 'lead') as Kind;
  const [kind, setKind] = useState<Kind>(initialKind);
  const [mode, setMode] = useState<Mode>('quick');
  const [values, setValues] = useState<Record<Kind, Record<string, string>>>(EMPTY_VALUES);
  const [docSource, setDocSource] = useState<'paste' | 'upload'>('paste');
  const [file, setFile] = useState<File | null>(null);
  const [runId, setRunId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const { run, error: streamError } = useRunStream(runId);
  const { refresh } = useSystem();
  const [, tick] = useState(0);

  const busy = submitting || (!!run && (run.status === 'queued' || run.status === 'running'));
  const v = values[kind];

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  useEffect(() => {
    if (run?.status === 'completed' || run?.status === 'failed') {
      refresh();
      if (run.status === 'completed') runsApi.approvals(run.id).then(setApprovals).catch(() => setApprovals([]));
    } else setApprovals([]);
  }, [run?.status, run?.id, refresh]);

  const switchKind = (k: Kind) => {
    setKind(k);
    setRunId(null);
    setSubmitError(null);
    router.replace(`/studio?kind=${k}`, { scroll: false });
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((all) => ({ ...all, [kind]: { ...all[kind], [field]: e.target.value } }));

  const applyExample = (ex: Record<string, string>) => {
    setValues((all) => ({ ...all, [kind]: { ...ex } }));
    if (kind === 'document') setDocSource('paste');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setRunId(null);
    const clean = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, x.trim() || undefined]));
    try {
      let started;
      if (kind === 'document' && docSource === 'upload') {
        if (!file) throw new Error('Choose a file to upload.');
        started = await runsApi.uploadDocument(file, v.document_type || 'auto', mode);
      } else {
        started = await runsApi.startJob(kind, clean(v), mode);
      }
      setRunId(started.id);
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const orbState: OrbState = !run ? (submitting ? 'thinking' : 'idle')
    : run.status === 'failed' ? 'error' : run.status === 'completed' ? 'done' : 'thinking';
  const statusLine = !run ? (submitting ? 'Starting...' : 'Waiting for something to read')
    : run.status === 'completed' ? `Done in ${formatDuration(run.duration_seconds)} · ${run.ai_model}`
    : run.status === 'failed' ? 'Something went wrong'
    : `${run.steps?.find((s) => s.status === 'running')?.name || 'Queued'} · ${formatDuration(elapsedSince(run.created_at))}`;

  return (
    <div className="space-y-8 pt-4">
      <PageHeader eyebrow="Studio" title="Feed it something" accent="messy."
        subtitle="Paste a lead, an email or a document. FlowMancer researches it, reads your knowledge base and hands back a structured verdict." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <motion.div variants={stagger()} initial="hidden" animate="show">
          <Panel>
            <form onSubmit={submit} className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented id="kind" label="What are you processing?" options={KINDS} value={kind} onChange={switchKind} />
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-xs text-fog"><Wand2 className="h-3.5 w-3.5 text-blush" aria-hidden />Try an example</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES[kind].map((ex) => (
                    <button key={ex.label} type="button" onClick={() => applyExample(ex.values)}
                      className="chip transition hover:border-blush/40 hover:bg-crimson/15 hover:text-bone">{ex.label}</button>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={kind} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }} className="space-y-4">
                  {kind === 'lead' && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Name" htmlFor="name"><input id="name" required value={v.name} onChange={set('name')} className="field" placeholder="Priya Sharma" /></Field>
                        <Field label="Email" htmlFor="email" hint="A company address lets it research the company.">
                          <input id="email" type="email" required value={v.email} onChange={set('email')} className="field" placeholder="priya@company.com" />
                        </Field>
                        <Field label="Company" htmlFor="company"><input id="company" value={v.company} onChange={set('company')} className="field" placeholder="Acme Corp" /></Field>
                        <Field label="Phone" htmlFor="phone"><input id="phone" type="tel" value={v.phone} onChange={set('phone')} className="field" /></Field>
                      </div>
                      <Field label="What they wrote" htmlFor="message">
                        <textarea id="message" rows={4} value={v.message} onChange={set('message')} className="field resize-none" placeholder="We need an enterprise plan for 500 users..." />
                      </Field>
                    </>
                  )}

                  {kind === 'email' && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="From" htmlFor="from_email"><input id="from_email" type="email" required value={v.from_email} onChange={set('from_email')} className="field" placeholder="customer@example.com" /></Field>
                        <Field label="Subject" htmlFor="subject"><input id="subject" required value={v.subject} onChange={set('subject')} className="field" placeholder="Can I get a refund?" /></Field>
                      </div>
                      <Field label="Message" htmlFor="body" hint="Replies quote your Knowledge base for policies and prices.">
                        <textarea id="body" rows={7} required value={v.body} onChange={set('body')} className="field resize-none" />
                      </Field>
                    </>
                  )}

                  {kind === 'document' && (
                    <>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <Segmented id="docsrc" size="sm" label="Document source" value={docSource} onChange={setDocSource}
                          options={[{ value: 'paste', label: 'Paste text' }, { value: 'upload', label: 'Upload file' }]} />
                        <div className="w-48">
                          <label htmlFor="document_type" className="sr-only">Document type</label>
                          <select id="document_type" value={v.document_type} onChange={set('document_type')} className="field !py-2">
                            <option value="auto">Detect type</option>
                            <option value="invoice">Invoice</option>
                            <option value="receipt">Receipt</option>
                            <option value="contract">Contract</option>
                            <option value="purchase_order">Purchase order</option>
                          </select>
                        </div>
                      </div>
                      {docSource === 'paste' ? (
                        <Field label="Document text" htmlFor="file_content">
                          <textarea id="file_content" rows={9} required value={v.file_content} onChange={set('file_content')}
                            className="field resize-none font-mono text-[13px]" placeholder="Invoice #123, Acme Ltd, Total $1,200, due 2026-11-01" />
                        </Field>
                      ) : <Dropzone file={file} setFile={setFile} />}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              <ModePicker mode={mode} setMode={setMode} />
              <ErrorBanner message={submitError} />
              <button type="submit" disabled={busy} className="btn-primary group w-full !py-3.5 text-[15px]">
                {busy ? 'Working...' : { lead: 'Qualify lead', email: 'Process email', document: 'Process document' }[kind]}
                {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />}
              </button>
            </form>
          </Panel>
        </motion.div>

        <motion.div variants={stagger()} initial="hidden" animate="show">
          <Panel className="min-h-[560px]">
            <div className="flex items-center gap-4" aria-live="polite">
              <Orb size={56} state={orbState} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-2xl leading-tight text-bone">
                  {!run ? 'Ready when you are' : run.status === 'completed' ? 'Here’s what I found' : run.status === 'failed' ? 'That didn’t work' : 'Thinking it through'}
                </p>
                <p className="truncate text-sm text-fog">{statusLine}</p>
              </div>
              {run && <StatusBadge status={run.status} />}
            </div>

            <ErrorBanner message={streamError} />

            {!run && !submitting && (
              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {[
                  ['01', 'Gather context', 'Web research for leads, your knowledge base for everything.'],
                  ['02', 'Reason', mode === 'crew' ? 'Four agents take turns, each building on the last.' : 'One careful pass over everything gathered.'],
                  ['03', 'Decide', 'A structured verdict, checked by code, ready for approval.'],
                ].map(([n, t, d]) => (
                  <div key={n} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <p className="font-mono text-xs text-blush">{n}</p>
                    <p className="mt-2 text-sm font-semibold text-bone">{t}</p>
                    <p className="mt-1 text-xs leading-relaxed text-fog">{d}</p>
                  </div>
                ))}
              </div>
            )}

            {run && (
              <div className="mt-8 space-y-8">
                {run.steps && <RunSteps steps={run.steps} />}
                {run.mode === 'crew' && run.status === 'running' && (
                  <p className="text-xs text-fog">Crew mode makes several AI calls in a row. You can leave this page; the result lands in History.</p>
                )}
                {(run.status === 'completed' || run.status === 'failed') && (
                  <div className="border-t border-white/[0.06] pt-8"><RunResult run={run} approvals={approvals} /></div>
                )}
              </div>
            )}
          </Panel>
        </motion.div>
      </div>
    </div>
  );
}
