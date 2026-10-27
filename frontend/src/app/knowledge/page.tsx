'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, FileUp, Search, Trash2 } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { Empty, ErrorBanner, Field, PageHeader, Panel, Spinner, stagger } from '@/components/ui';
import { errorMessage, knowledgeApi } from '@/lib/api';
import type { KnowledgeDocument } from '@/types';
import { cn, timeAgo } from '@/lib/utils';

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ doc_name: string; text: string; score: number | null }[] | null>(null);
  const [over, setOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const load = () => knowledgeApi.list().then(setDocs).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const wrap = async (fn: () => Promise<KnowledgeDocument | unknown>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      toast({ tone: 'success', title: done });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const addText = (e: React.FormEvent) => {
    e.preventDefault();
    wrap(async () => {
      await knowledgeApi.addText(name, text);
      setName('');
      setText('');
    }, `Added "${name}"`);
  };

  const upload = (file?: File | null) => {
    if (file) wrap(() => knowledgeApi.upload(file), `Indexed ${file.name}`);
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      setResults(await knowledgeApi.search(query));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-8 pt-4">
      <PageHeader eyebrow="Knowledge" title="Teach it" accent="your rules."
        subtitle="Pricing, policies, FAQs. Replies and talking points quote these instead of guessing. Stored and searched on this machine." />
      <ErrorBanner message={error} />

      <motion.div variants={stagger()} initial="hidden" animate="show" className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Add" title="New knowledge">
          <div
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files?.[0]); }}
            className={cn('mb-5 flex items-center gap-4 rounded-2xl border border-dashed p-4 transition',
              over ? 'border-blush bg-crimson/10' : 'border-white/15 bg-noir-950/40')}>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-crimson/20 text-blush">
              {busy ? <Spinner className="h-5 w-5" /> : <FileUp className="h-5 w-5" aria-hidden />}
            </span>
            <div className="flex-1 text-sm">
              <p className="text-bone">{busy ? 'Indexing...' : 'Drop a file here'}</p>
              <p className="text-xs text-fog">PDF, TXT, MD, CSV or HTML. The first upload downloads a small local model (~80 MB).</p>
            </div>
            <button type="button" className="btn-ghost !py-1.5 text-xs" disabled={busy} onClick={() => fileInput.current?.click()}>Browse</button>
            <input ref={fileInput} type="file" className="sr-only" aria-label="Upload knowledge file"
              accept=".pdf,.txt,.md,.csv,.html,.htm,.json" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          <form onSubmit={addText} className="space-y-4">
            <Field label="Title" htmlFor="kname"><input id="kname" required value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Refund policy" /></Field>
            <Field label="Text" htmlFor="ktext">
              <textarea id="ktext" rows={7} required value={text} onChange={(e) => setText(e.target.value)} className="field resize-none"
                placeholder="Customers can request a full refund within 30 days of purchase..." />
            </Field>
            <button type="submit" disabled={busy} className="btn-primary">Add text</button>
          </form>
        </Panel>

        <Panel eyebrow="Test" title="What would the AI read?">
          <form onSubmit={search} className="flex gap-2">
            <label htmlFor="kq" className="sr-only">Question</label>
            <input id="kq" value={query} onChange={(e) => setQuery(e.target.value)} className="field" placeholder="Can I get my money back?" />
            <button type="submit" className="btn-ghost shrink-0"><Search className="h-4 w-4" aria-hidden /> Search</button>
          </form>
          <div className="mt-5 space-y-3" aria-live="polite">
            {results && results.length === 0 && <p className="py-8 text-center text-sm text-fog">Nothing relevant. The AI won&apos;t use the knowledge base for this question.</p>}
            {results?.map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] text-blush">{r.doc_name}</p>
                  {r.score !== null && (
                    <span className="flex items-center gap-2 font-mono text-[11px] text-fog">
                      <span className="h-1 w-16 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-crimson-400" style={{ width: `${Math.round(r.score * 100)}%` }} /></span>
                      {Math.round(r.score * 100)}%
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-4 text-sm text-bone/85">{r.text}</p>
              </motion.div>
            ))}
            {!results && <p className="py-8 text-center text-sm text-fog">Ask a question a customer might send.</p>}
          </div>
        </Panel>
      </motion.div>

      <section>
        <p className="eyebrow mb-4">Library · {docs?.length ?? 0}</p>
        {!docs ? <div className="flex justify-center py-8"><Spinner /></div> : docs.length === 0 ? (
          <div className="glass"><Empty title="An empty library">Add a policy or FAQ and email replies will start quoting it.</Empty></div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {docs.map((d) => (
                <motion.li key={d.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                  className="glass group flex items-center gap-4 !rounded-2xl p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-blush"><BookOpen className="h-[18px] w-[18px]" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-bone">{d.name}</p>
                    <p className="font-mono text-[11px] text-fog">{d.characters.toLocaleString()} chars · {d.chunks} chunk{d.chunks === 1 ? '' : 's'} · {timeAgo(d.created_at)}</p>
                  </div>
                  <button type="button" aria-label={`Delete ${d.name}`} disabled={busy}
                    onClick={() => confirm(`Delete "${d.name}"?`) && wrap(() => knowledgeApi.remove(d.id), `Deleted "${d.name}"`)}
                    className="rounded-full p-2 text-fog opacity-60 transition hover:bg-coral/10 hover:text-coral group-hover:opacity-100 focus-visible:opacity-100">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
