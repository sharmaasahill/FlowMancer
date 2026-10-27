import { Suspense } from 'react';
import type { Metadata } from 'next';
import WorkflowList from '@/components/WorkflowList';
import { Loading } from '@/components/ui';

export const metadata: Metadata = { title: 'Workflows' };

export default function WorkflowsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <WorkflowList />
    </Suspense>
  );
}
