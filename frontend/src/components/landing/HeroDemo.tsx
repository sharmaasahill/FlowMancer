'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Check, RotateCcw } from 'lucide-react';
import Orb from '@/components/Orb';
import { REFUND_EMAIL, REFUND_POLICY, REFUND_REPLY } from '@/components/landing/content';
import { cn } from '@/lib/utils';

const INBOX = [
  { from: REFUND_EMAIL.from, subject: REFUND_EMAIL.subject, time: '09:12', open: true },
  { from: 'ops@bigclient.com', subject: 'Production down!', time: '09:04', open: false },
  { from: 'seo@rankfast.biz', subject: 'Get 1st page Google ranking!!!', time: '08:51', open: false },
];

/* When each part of the result appears (ms after the demo scrolls into view). */
const STEP_AT = [700, 1500, 2400, 3300];
const DONE = STEP_AT.length;
const STATUS = ['Reading the email', 'Sorting the email', 'Writing a reply', 'Preparing the approval', 'Done in 2.8 s'];

function StepTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[13px] font-semibold text-bone">
      <span className="grid h-4 w-4 place-items-center rounded-full bg-jade/15 text-jade">
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
      {children}
    </p>
  );
}

/**
 * The hero: a real refund email being handled, drawn in code (sharp at any size) rather than
 * a screen recording. Plays once when it scrolls into view; shows the finished state at once
 * for people who turn off motion.
 */
export default function HeroDemo() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (reduce) {
      setStage(DONE);
      return;
    }
    if (!inView) return;
    setStage(0);
    const timers = STEP_AT.map((ms, i) => window.setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [inView, reduce, run]);

  const reveal = (n: number) => ({
    initial: false as const,
    animate: stage >= n ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  });
  const done = stage >= DONE;

  return (
    <figure ref={ref}>
      <div aria-hidden className="overflow-hidden rounded-[20px] border border-white/[0.09] bg-[#0F0B0C] shadow-[0_40px_120px_-48px_rgba(0,0,0,0.95)]">
        <div className="grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* Inbox */}
          <div className="flex flex-col border-b border-white/[0.07] md:border-b-0 md:border-r">
            <div className="flex h-12 items-center justify-between border-b border-white/[0.07] px-5 text-[13px]">
              <span className="font-semibold text-bone">Inbox</span>
              <span className="text-fog">3 new</span>
            </div>
            <ul className="hidden sm:block">
              {INBOX.map((m) => (
                <li key={m.from} className={cn('relative flex items-baseline gap-3 border-b border-white/[0.05] px-5 py-3 text-[13px]', m.open && 'bg-white/[0.035]')}>
                  {m.open && <span className="absolute inset-y-0 left-0 w-0.5 bg-crimson-400" />}
                  <span className={cn('w-[136px] shrink-0 truncate', m.open ? 'font-semibold text-bone' : 'text-bone/80')}>{m.from}</span>
                  <span className="min-w-0 flex-1 truncate text-fog">{m.subject}</span>
                  <span className="font-mono text-[11px] text-ash">{m.time}</span>
                </li>
              ))}
            </ul>
            <div className="px-5 py-6">
              <p className="text-[12px] text-fog">From {REFUND_EMAIL.from}</p>
              <p className="mt-1 text-[17px] font-semibold text-bone">{REFUND_EMAIL.subject}</p>
              <p className="mt-4 text-[14px] leading-[1.7] text-bone/80">{REFUND_EMAIL.body}</p>
            </div>
            <div className="mt-auto hidden items-center justify-between border-t border-white/[0.07] px-5 py-4 text-[12px] text-fog md:flex">
              <span>Picked up from Gmail</span>
              <span className="font-mono text-[11px] text-ash">09:12</span>
            </div>
          </div>

          {/* FlowMancer's result */}
          <div className="flex flex-col bg-[#130E0F]">
            <div className="flex h-12 items-center gap-2.5 border-b border-white/[0.07] px-5 text-[13px] sm:px-6">
              <Orb size={18} state={done ? 'done' : 'thinking'} />
              <span className="font-semibold text-bone">FlowMancer</span>
              <span className={cn('ml-auto', done ? 'text-jade' : 'text-fog')}>{STATUS[stage]}</span>
            </div>
            <div className="flex-1 space-y-6 px-5 py-6 sm:px-6">
              <motion.div {...reveal(1)}>
                <StepTitle>Checked the refund policy</StepTitle>
                <blockquote className="mt-2.5 border-l-2 border-white/15 pl-3 text-[13px] leading-[1.6] text-fog">
                  &ldquo;{REFUND_POLICY}&rdquo;
                  <span className="mt-1 block font-mono text-[11px] text-ash">Refund policy.md</span>
                </blockquote>
              </motion.div>
              <motion.div {...reveal(2)}>
                <StepTitle>Sorted the email</StepTitle>
                <div className="mt-2.5 flex flex-wrap gap-1.5 text-[12px]">
                  {['Billing', 'High priority', 'Neutral tone', 'For the billing team'].map((t) => (
                    <span key={t} className="rounded-md border border-white/10 px-2 py-0.5 text-bone/85">{t}</span>
                  ))}
                </div>
              </motion.div>
              <motion.div {...reveal(3)}>
                <StepTitle>Wrote a reply</StepTitle>
                <p className="mt-2.5 rounded-xl border border-white/[0.08] bg-noir-950/70 p-4 text-[13.5px] leading-[1.65] text-bone/90">{REFUND_REPLY}</p>
              </motion.div>
            </div>
            <motion.div {...reveal(4)} className="flex flex-wrap items-center gap-3 border-t border-white/[0.07] px-5 py-4 sm:px-6">
              <span className="h-2 w-2 rounded-full bg-amber" />
              <span className="text-[13px] text-bone">Waiting for your approval</span>
              <span className="ml-auto flex gap-2 text-[12px] font-semibold">
                <span className="rounded-full border border-white/15 px-3.5 py-1.5 text-bone">Edit</span>
                <span className="rounded-full bg-crimson px-3.5 py-1.5 text-white">Approve</span>
              </span>
            </motion.div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 flex items-start justify-between gap-6 text-[13px] text-fog">
        <span>
          A real result from the live demo. The reply follows the refund policy the business uploaded, and nothing is sent until someone approves it.
        </span>
        {done && !reduce && (
          <button type="button" onClick={() => setRun((r) => r + 1)} className="inline-flex shrink-0 items-center gap-1.5 text-bone hover:text-white">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Replay
          </button>
        )}
      </figcaption>
    </figure>
  );
}
