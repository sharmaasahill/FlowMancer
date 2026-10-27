import { Suspense } from 'react';
import type { Metadata } from 'next';
import Studio from '@/components/Studio';
import { Loading } from '@/components/ui';

export const metadata: Metadata = { title: 'Studio' };

export default function StudioPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Studio />
    </Suspense>
  );
}
