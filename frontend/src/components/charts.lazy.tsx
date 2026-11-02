'use client';

import dynamic from 'next/dynamic';

/*
 * The chart library (Recharts) is about 100 KB. Loading it separately lets the page
 * show its numbers first and draw the charts a moment later.
 */
const placeholder = () => <div className="h-full w-full animate-pulse rounded-2xl bg-white/[0.02]" />;

export const ActivityChart = dynamic(() => import('@/components/charts').then((m) => m.ActivityChart), { ssr: false, loading: placeholder });
export const QualityDonut = dynamic(() => import('@/components/charts').then((m) => m.QualityDonut), { ssr: false, loading: placeholder });
export const CategoryBars = dynamic(() => import('@/components/charts').then((m) => m.CategoryBars), { ssr: false, loading: placeholder });
export const TokenChart = dynamic(() => import('@/components/charts').then((m) => m.TokenChart), { ssr: false, loading: placeholder });
