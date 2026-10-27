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
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

export function elapsedSince(start: string | null): number {
  return start ? Math.max(0, (Date.now() - new Date(start).getTime()) / 1000) : 0;
}

export const KIND_LABELS: Record<string, string> = {
  lead: 'Lead',
  email: 'Email',
  document: 'Document',
};

export const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  approved: 'bg-green-100 text-green-800',
  success: 'bg-green-100 text-green-800',
  skipped: 'bg-gray-100 text-gray-700',
  failed: 'bg-red-100 text-red-800',
  error: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
};

export const LEVEL_STYLES: Record<string, string> = {
  High: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-gray-100 text-gray-700',
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-700',
  positive: 'bg-green-100 text-green-800',
  neutral: 'bg-gray-100 text-gray-700',
  negative: 'bg-red-100 text-red-800',
  valid: 'bg-green-100 text-green-800',
  invalid: 'bg-red-100 text-red-800',
  needs_review: 'bg-yellow-100 text-yellow-800',
};

/** One-line description of a run for lists. */
export function summary(r: { kind: string; input_data: Record<string, any> | null; output: Record<string, any> | null }): string {
  const i = r.input_data || {};
  const o = (r.output || {}) as Record<string, any>;
  if (r.kind === 'lead') {
    return `${i.name || ''}${i.company ? ` (${i.company})` : ''}${o.lead_score !== undefined ? ` - ${o.lead_score}/100 ${o.qualification}` : ''}`;
  }
  if (r.kind === 'email') return `${i.subject || ''}${o.category ? ` - ${o.category}, ${o.priority}` : ''}`;
  return `${i.file_name || i.document_type || 'document'}${o.document_type ? ` - ${o.document_type}, ${o.validation_status}` : ''}`;
}
