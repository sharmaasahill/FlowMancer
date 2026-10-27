'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Builder from '@/components/workflow/Builder';
import { ErrorBanner, Loading } from '@/components/ui';
import { errorMessage, workflowsApi } from '@/lib/api';
import type { Workflow } from '@/types';

export default function WorkflowBuilderPage() {
  const params = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workflowsApi.get(Number(params.id)).then(setWorkflow).catch((e) => setError(errorMessage(e)));
  }, [params.id]);

  return (
    <div className="space-y-6 pt-4">
      <Link href="/workflows" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blush hover:gap-2.5 [transition:gap_.2s]">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Workflows
      </Link>
      <ErrorBanner message={error} />
      {!workflow && !error && <Loading />}
      {workflow && <Builder workflow={workflow} onSaved={setWorkflow} />}
    </div>
  );
}
