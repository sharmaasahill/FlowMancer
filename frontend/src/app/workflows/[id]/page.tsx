'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { errorMessage, workflowsApi } from '@/lib/api';
import type { Workflow } from '@/types';
import Builder from '@/components/workflow/Builder';
import { ErrorBanner, Spinner } from '@/components/ui';

export default function WorkflowBuilderPage() {
  const params = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workflowsApi.get(Number(params.id)).then(setWorkflow).catch((e) => setError(errorMessage(e)));
  }, [params.id]);

  return (
    <div className="space-y-4">
      <Link href="/workflows" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Workflows
      </Link>
      <ErrorBanner message={error} />
      {!workflow && !error && <div className="flex justify-center py-24"><Spinner className="h-8 w-8 text-blue-600" /></div>}
      {workflow && !workflow.config?.nodes?.length && workflow.workflow_type !== 'custom' && (
        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
          This is a simple {workflow.workflow_type.replace('_', ' ')} workflow. Saving here turns it into a custom graph workflow.
        </p>
      )}
      {workflow && <Builder workflow={workflow} onSaved={setWorkflow} />}
    </div>
  );
}
