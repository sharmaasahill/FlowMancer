'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Plus, Trash2, X } from 'lucide-react';
import MiniGraph from '@/components/workflow/MiniGraph';
import { Badge, Empty, ErrorBanner, Loading, PageHeader, rise, Spinner, stagger } from '@/components/ui';
import { errorMessage, workflowsApi } from '@/lib/api';
import type { Workflow } from '@/types';
import { TEMPLATES } from '@/lib/workflowTemplates';
import { cn, timeAgo } from '@/lib/utils';

const TRIGGER_LABELS: Record<string, string> = { manual: 'Manual', form: 'Website form', inbox: 'Inbox', webhook: 'Webhook' };

function triggerOf(w: Workflow): string {
  const t = w.config?.nodes?.find((n) => n.type === 'trigger');
  return t ? TRIGGER_LABELS[t.data.trigger] || t.data.trigger : 'No trigger';
}

export default function WorkflowList() {
  const router = useRouter();
  const params = useSearchParams();
  const [workflows, setWorkflows] = useState<Workflow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [gallery, setGallery] = useState(params.get('new') === '1');

  useEffect(() => {
    workflowsApi.list().then(setWorkflows).catch((e) => setError(errorMessage(e)));
  }, []);

  const create = async (templateId: string) => {
    const t = TEMPLATES.find((x) => x.id === templateId)!;
    setCreating(templateId);
    setError(null);
    try {
      const wf = await workflowsApi.create({
        name: t.id === 'blank' ? 'Untitled workflow' : t.name, description: t.id === 'blank' ? '' : t.description,
        is_active: true, config: t.graph,
      });
      router.push(`/workflows/${wf.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setCreating(null);
    }
  };

  const remove = async (w: Workflow) => {
    if (!confirm(`Delete "${w.name}"?`)) return;
    try {
      await workflowsApi.remove(w.id);
      setWorkflows((ws) => (ws || []).filter((x) => x.id !== w.id));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-8 pt-4">
      <PageHeader eyebrow="Workflows" title="Automations that" accent="run themselves."
        subtitle="Chain a trigger, AI steps, conditions and actions. Start from a template and change anything.">
        <button type="button" onClick={() => setGallery((g) => !g)} aria-expanded={gallery} className="btn-primary !px-5 !py-2.5">
          {gallery ? <X className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />} {gallery ? 'Close' : 'New workflow'}
        </button>
      </PageHeader>
      <ErrorBanner message={error} />

      <AnimatePresence initial={false}>
        {gallery && (
          <motion.section initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden" aria-label="Templates">
            <p className="eyebrow mb-4">Start from</p>
            <div className="grid gap-4 pb-2 md:grid-cols-2 xl:grid-cols-4">
              {TEMPLATES.map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <button type="button" onClick={() => create(t.id)} disabled={!!creating}
                  className="glass group flex h-full w-full flex-col overflow-hidden !rounded-[22px] text-left transition hover:-translate-y-1 hover:border-crimson-400/40 disabled:opacity-50">
                  <div className="relative h-32 bg-noir-950/60">
                    <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100" aria-hidden
                      style={{ background: 'radial-gradient(70% 90% at 50% 0%, rgba(155,19,19,0.35), transparent)' }} />
                    <MiniGraph graph={t.graph} className="relative h-full w-full p-3" />
                  </div>
                  <div className="flex-1 p-4">
                    <p className="flex items-center gap-2 font-semibold text-bone">{t.name} {creating === t.id && <Spinner className="h-4 w-4" />}</p>
                    <p className="mt-1 text-xs leading-relaxed text-fog">{t.description}</p>
                  </div>
                </button>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {!workflows ? <Loading /> : workflows.length === 0 ? (
        <div className="glass"><Empty title="No workflows yet" action={<button type="button" className="btn-primary" onClick={() => setGallery(true)}>Pick a template</button>}>
          Templates get you a working automation in one click.
        </Empty></div>
      ) : (
        <motion.ul variants={stagger(0.05)} initial="hidden" animate="show" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((w) => (
            <motion.li key={w.id} variants={rise}>
            <div className="glass group relative flex h-full flex-col overflow-hidden !rounded-[24px] transition hover:-translate-y-1 hover:shadow-lift">
              <Link href={`/workflows/${w.id}`} className="absolute inset-0 z-10" aria-label={`Open ${w.name}`} />
              <div className="relative h-40 border-b border-white/[0.06] bg-noir-950/50">
                <div className="absolute inset-0 opacity-50 transition group-hover:opacity-100" aria-hidden
                  style={{ background: 'radial-gradient(60% 90% at 50% 0%, rgba(155,19,19,0.3), transparent)' }} />
                <MiniGraph graph={w.config} className="relative h-full w-full p-4" />
                <span className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition duration-500 group-hover:rotate-45 group-hover:bg-white group-hover:text-noir-900">
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-bone">{w.name}</p>
                  <Badge className={w.is_active ? 'border-jade/25 bg-jade/[0.08] text-jade' : 'border-white/10 bg-white/[0.03] text-fog'}>
                    {w.is_active ? 'active' : 'paused'}
                  </Badge>
                </div>
                {w.description && <p className="mt-1 line-clamp-2 text-sm text-fog">{w.description}</p>}
                <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-fog">
                  <span className="chip">{triggerOf(w)}</span>
                  <span className="chip">{Math.max(0, (w.config?.nodes?.length || 1) - 1)} steps</span>
                  <span className="ml-auto">{timeAgo(w.created_at)}</span>
                  <button type="button" onClick={() => remove(w)} aria-label={`Delete ${w.name}`}
                    className={cn('relative z-20 rounded-full p-1.5 text-fog transition hover:bg-coral/10 hover:text-coral')}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
