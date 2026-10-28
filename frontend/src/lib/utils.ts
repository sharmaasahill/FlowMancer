/**
 * Utility functions
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "just now", "5m ago", "3h ago", "Oct 12" */
export function timeAgo(date: string | null | undefined): string {
  if (!date) return '';
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export function elapsedSince(start: string | null): number {
  return start ? Math.max(0, (Date.now() - new Date(start).getTime()) / 1000) : 0;
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export const KIND_LABELS: Record<string, string> = { lead: 'Lead', email: 'Email', document: 'Document' };

/* Tones for dark surfaces: tinted text + faint fill + hairline border (full class names so Tailwind keeps them) */
export const STATUS_TONES: Record<string, string> = {
  completed: 'text-jade bg-jade/[0.08] border-jade/25',
  approved: 'text-jade bg-jade/[0.08] border-jade/25',
  success: 'text-jade bg-jade/[0.08] border-jade/25',
  running: 'text-blush bg-blush/[0.08] border-blush/25',
  queued: 'text-amber bg-amber/[0.08] border-amber/25',
  pending: 'text-amber bg-amber/[0.08] border-amber/25',
  skipped: 'text-fog bg-white/[0.03] border-white/10',
  failed: 'text-coral bg-coral/[0.08] border-coral/25',
  error: 'text-coral bg-coral/[0.08] border-coral/25',
  rejected: 'text-coral bg-coral/[0.08] border-coral/25',
  // AI call outcomes (Usage page)
  ok: 'text-jade bg-jade/[0.08] border-jade/25',
  rate_limited: 'text-amber bg-amber/[0.08] border-amber/25',
  busy: 'text-amber bg-amber/[0.08] border-amber/25',
  timeout: 'text-amber bg-amber/[0.08] border-amber/25',
};

/** 48213 -> "48.2K" */
export function compactNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '-';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Dollar amounts too small for cents still show a value: 0.00038 -> "$0.0004". */
export function formatUsd(v: number | null | undefined): string {
  if (v === null || v === undefined) return '-';
  if (v === 0) return '$0.00';
  if (v < 0.0001) return '<$0.0001';
  return `$${v < 1 ? v.toFixed(4) : v.toFixed(2)}`;
}

export const LEVEL_TONES: Record<string, string> = {
  High: 'text-white bg-crimson border-crimson-400/50',
  Medium: 'text-blush bg-blush/[0.08] border-blush/25',
  Low: 'text-fog bg-white/[0.03] border-white/10',
  urgent: 'text-white bg-crimson border-crimson-400/50',
  high: 'text-blush bg-blush/[0.08] border-blush/25',
  medium: 'text-amber bg-amber/[0.08] border-amber/25',
  low: 'text-fog bg-white/[0.03] border-white/10',
  positive: 'text-jade bg-jade/[0.08] border-jade/25',
  neutral: 'text-fog bg-white/[0.03] border-white/10',
  negative: 'text-coral bg-coral/[0.08] border-coral/25',
  valid: 'text-jade bg-jade/[0.08] border-jade/25',
  invalid: 'text-coral bg-coral/[0.08] border-coral/25',
  needs_review: 'text-amber bg-amber/[0.08] border-amber/25',
};

/** One-line description of a run for lists. */
export function summary(r: { kind: string; input_data: Record<string, any> | null; output: Record<string, any> | null }): string {
  const i = r.input_data || {};
  const o = (r.output || {}) as Record<string, any>;
  if (r.kind === 'lead') return `${i.name || ''}${i.company ? ` · ${i.company}` : ''}`;
  if (r.kind === 'email') return i.subject || i.from_email || 'Email';
  return i.file_name || o.counterparty || (i.document_type && i.document_type !== 'auto' ? i.document_type : 'Document');
}

/** Short result line for lists. */
export function verdict(r: { kind: string; output: Record<string, any> | null }): string {
  const o = r.output as Record<string, any> | null;
  if (!o) return '';
  if (r.kind === 'lead') return `${o.lead_score}/100 · ${o.qualification}`;
  if (r.kind === 'email') return `${o.category} · ${o.priority}`;
  const amount = o.total_amount !== null && o.total_amount !== undefined ? `${o.total_amount.toLocaleString()} ${o.currency || ''}` : '';
  return [o.document_type, amount].filter(Boolean).join(' · ');
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
