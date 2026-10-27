'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronRight, Minus, X } from 'lucide-react';
import type { Step } from '@/types';
import { cn, formatDuration } from '@/lib/utils';

function duration(step: Step): string | null {
  if (!step.started_at) return null;
  const end = step.finished_at ? new Date(step.finished_at).getTime() : Date.now();
  return formatDuration((end - new Date(step.started_at).getTime()) / 1000);
}

function Node({ status }: { status: Step['status'] }) {
  return (
    <span className={cn('relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors duration-500',
      status === 'completed' && 'border-crimson-400/60 bg-crimson text-white shadow-ember',
      status === 'running' && 'border-blush/60 bg-noir-900 text-blush',
      status === 'failed' && 'border-coral/50 bg-coral/15 text-coral',
      status === 'skipped' && 'border-white/10 bg-noir-850 text-ash',
      status === 'pending' && 'border-white/10 bg-noir-900 text-ash')}>
      {status === 'running' && <span className="absolute inset-0 animate-breathe rounded-full border border-blush/70" />}
      {status === 'completed' && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
      {status === 'failed' && <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
      {status === 'skipped' && <Minus className="h-3.5 w-3.5" aria-hidden />}
      {status === 'running' && <span className="h-2 w-2 rounded-full bg-blush" />}
      {status === 'pending' && <span className="h-1.5 w-1.5 rounded-full bg-ash" />}
    </span>
  );
}

/** Pipeline timeline. The rail fills as steps finish; the running step pulses. */
export default function RunSteps({ steps }: { steps: Step[] }) {
  const [, tick] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const running = steps.some((s) => s.status === 'running');
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [running]);

  const done = steps.filter((s) => s.status !== 'pending' && s.status !== 'running').length;
  const progress = steps.length > 1 ? Math.min(1, done / (steps.length - 1)) : 0;

  return (
    <div className="relative">
      <div className="absolute bottom-3.5 left-[13px] top-3.5 w-px bg-white/[0.08]" aria-hidden />
      <motion.div className="absolute left-[13px] top-3.5 w-px origin-top bg-gradient-to-b from-crimson-400 to-blush"
        style={{ bottom: 14 }} initial={{ scaleY: 0 }} animate={{ scaleY: progress }}
        transition={{ type: 'spring', stiffness: 90, damping: 20 }} aria-hidden />
      <ol className="relative space-y-1" aria-label="Processing steps">
        {steps.map((step, i) => {
          const d = duration(step);
          const expandable = !!step.output && step.status !== 'running';
          const isOpen = open === step.name;
          return (
            <motion.li key={step.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}>
              <button type="button" disabled={!expandable} onClick={() => setOpen(isOpen ? null : step.name)}
                aria-expanded={expandable ? isOpen : undefined}
                className={cn('relative flex w-full items-center gap-3 overflow-hidden rounded-xl py-1.5 pr-2 text-left',
                  expandable && 'hover:bg-white/[0.03]')}>
                <Node status={step.status} />
                <span className={cn('flex-1 text-sm font-medium transition-colors',
                  step.status === 'pending' ? 'text-ash' : step.status === 'running' ? 'text-blush' : 'text-bone')}>
                  {step.name}
                  <span className="sr-only">: {step.status}</span>
                </span>
                {step.status === 'running' && (
                  <span className="absolute inset-y-0 left-10 right-0 overflow-hidden rounded-xl" aria-hidden>
                    <span className="absolute inset-y-0 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-blush/[0.08] to-transparent" />
                  </span>
                )}
                {d && <span className="font-mono text-[11px] tabular-nums text-fog">{d}</span>}
                {expandable && <ChevronRight className={cn('h-4 w-4 text-ash transition-transform', isOpen && 'rotate-90')} aria-hidden />}
              </button>
              <AnimatePresence initial={false}>
                {isOpen && step.output && (
                  <motion.pre initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="ml-10 overflow-hidden whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-noir-950/60 text-xs leading-relaxed text-fog">
                    <span className="block max-h-64 overflow-auto p-3">{step.output}</span>
                  </motion.pre>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
