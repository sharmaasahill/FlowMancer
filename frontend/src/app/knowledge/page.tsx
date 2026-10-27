'use client';

import { useEffect, useState } from 'react';
import { Search, Trash2, Upload } from 'lucide-react';
import { errorMessage, knowledgeApi } from '@/lib/api';
import type { KnowledgeDocument } from '@/types';
import { Card, Empty, ErrorBanner, Field, PageHeader, Spinner, buttonClass, inputClass } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export default function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ doc_name: string; text: string; score: number | null }[] | null>(null);

  const load = () => knowledgeApi.list().then(setDocs).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const wrap = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const addText = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    wrap(async () => {
      await knowledgeApi.addText(String(f.get('name')), String(f.get('text')));
      form.reset();
    });
  };

  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) wrap(() => knowledgeApi.upload(file));
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
    <div className="space-y-6">
      <PageHeader title="Knowledge base"
        subtitle="Pricing, policies, FAQs. Email replies and lead talking points use this instead of guessing. Stored and searched locally." />
      <ErrorBanner message={error} />
      {busy && <p className="flex items-center gap-2 text-sm text-gray-600" role="status"><Spinner className="h-4 w-4" /> Indexing... the first upload downloads a small embedding model (~80 MB).</p>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Add knowledge">
          <form onSubmit={addText} className="space-y-4">
            <Field label="Title" htmlFor="kname"><input id="kname" name="name" required className={inputClass} placeholder="Refund policy" /></Field>
            <Field label="Text" htmlFor="ktext">
              <textarea id="ktext" name="text" rows={8} required className={inputClass}
                placeholder="Customers can request a full refund within 30 days of purchase..." />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className={buttonClass.primary}>Add text</button>
              <label className={`${buttonClass.secondary} cursor-pointer focus-within:ring-2 focus-within:ring-blue-500`}>
                <Upload className="h-4 w-4" aria-hidden /> Upload file
                <input type="file" className="sr-only" accept=".pdf,.txt,.md,.csv,.html,.htm,.json" onChange={upload} disabled={busy} />
              </label>
            </div>
          </form>
        </Card>

        <Card title="Test retrieval">
          <form onSubmit={search} className="flex gap-2">
            <label htmlFor="kq" className="sr-only">Question</label>
            <input id="kq" value={query} onChange={(e) => setQuery(e.target.value)} className={inputClass} placeholder="Can I get my money back?" />
            <button type="submit" className={buttonClass.secondary}><Search className="h-4 w-4" aria-hidden /> Search</button>
          </form>
          <div className="mt-4 space-y-2" aria-live="polite">
            {results && results.length === 0 && <Empty>No relevant entries. The AI won&apos;t use the knowledge base for this.</Empty>}
            {results?.map((r, i) => (
              <div key={i} className="rounded-md bg-gray-50 p-3 text-sm">
                <p className="text-xs font-semibold text-gray-600">{r.doc_name} {r.score !== null && `(match ${Math.round(r.score * 100)}%)`}</p>
                <p className="mt-1 line-clamp-4 text-gray-800">{r.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Documents">
        {!docs ? <div className="flex justify-center py-6"><Spinner /></div> : docs.length === 0 ? <Empty>No documents yet.</Empty> : (
          <ul className="divide-y divide-gray-100">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-4 py-3 text-sm">
                <span className="flex-1 font-medium">{d.name}</span>
                <span className="text-gray-500">{d.characters.toLocaleString()} chars, {d.chunks} chunks</span>
                <span className="text-gray-500">{formatDate(d.created_at)}</span>
                <button type="button" aria-label={`Delete ${d.name}`} disabled={busy}
                  onClick={() => confirm(`Delete "${d.name}"?`) && wrap(() => knowledgeApi.remove(d.id))}
                  className="rounded-md p-2 text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
