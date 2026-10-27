'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { errorMessage, workflowsApi } from '@/lib/api';
import type { Workflow } from '@/types';
import { TEMPLATES } from '@/lib/workflowTemplates';
import { Badge, Card, Empty, ErrorBanner, PageHeader, Spinner, buttonClass } from '@/components/ui';
import { formatDate } from '@/lib/utils';

const TRIGGER_LABELS: Record<string, string> = { manual: 'Manual', form: 'Website form', inbox: 'Inbox', webhook: 'Webhook' };

function triggerOf(w: Workflow): string {
  const t = w.config?.nodes?.find((n) => n.type === 'trigger');
  return t ? TRIGGER_LABELS[t.data.trigger] || t.data.trigger : 'Manual';
}

export default function WorkflowList() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<Workflow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    workflowsApi.list().then(setWorkflows).catch((e) => setError(errorMessage(e)));
  }, []);

  const create = async (templateId: string) => {
    const t = TEMPLATES.find((x) => x.id === templateId)!;
    setCreating(templateId);
    setError(null);
    try {
      const wf = await workflowsApi.create({
        name: t.id === 'blank' ? 'New workflow' : t.name, description: t.id === 'blank' ? '' : t.description,
        workflow_type: 'custom', is_active: true, config: t.graph,
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
    <div className="space-y-6">
      <PageHeader title="Workflows" subtitle="Chain triggers, AI steps, conditions and actions visually">
        <button type="button" onClick={() => setShowTemplates((s) => !s)} aria-expanded={showTemplates} className={buttonClass.primary}>
          <Plus className="h-4 w-4" aria-hidden /> New workflow
        </button>
      </PageHeader>
      <ErrorBanner message={error} />

      {showTemplates && (
        <Card title="Start from">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => create(t.id)} disabled={!!creating}
                className="rounded-lg border border-gray-200 p-4 text-left hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50">
                <p className="flex items-center gap-2 font-semibold text-gray-900">{t.name} {creating === t.id && <Spinner className="h-4 w-4" />}</p>
                <p className="mt-1 text-sm text-gray-600">{t.description}</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        {!workflows ? <div className="flex justify-center py-12"><Spinner className="h-8 w-8 text-blue-600" /></div>
          : workflows.length === 0 ? <Empty>No workflows yet. Click &quot;New workflow&quot; to start from a template.</Empty> : (
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left text-gray-700">
                <tr>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Trigger</th>
                  <th scope="col" className="px-4 py-3">Steps</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Created</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workflows.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/workflows/${w.id}`} className="font-semibold text-blue-700 hover:underline">{w.name}</Link>
                      {w.description && <p className="line-clamp-1 text-gray-600">{w.description}</p>}
                    </td>
                    <td className="px-4 py-3">{triggerOf(w)}</td>
                    <td className="px-4 py-3">{w.config?.nodes?.length ? w.config.nodes.length - 1 : w.workflow_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3">
                      <Badge className={w.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>{w.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(w.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link href={`/workflows/${w.id}`} aria-label={`Edit ${w.name}`} className="rounded-md p-2 text-gray-700 hover:bg-gray-100">
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Link>
                        <button type="button" onClick={() => remove(w)} aria-label={`Delete ${w.name}`} className="rounded-md p-2 text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Card>
    </div>
  );
}
