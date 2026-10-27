'use client';

import { useCallback, useEffect, useRef } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type Variants } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Orb from '@/components/Orb';
import { cn, STATUS_TONES } from '@/lib/utils';

/* ---------- motion presets ---------- */
export const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 28 } },
};
export const stagger = (delay = 0.06): Variants => ({ hidden: {}, show: { transition: { staggerChildren: delay } } });

/* ---------- layout ---------- */
export function PageHeader({ eyebrow, title, accent, subtitle, children }: {
  eyebrow?: string; title: string; accent?: string; subtitle?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="font-display text-[44px] leading-[1.02] tracking-tight text-bone sm:text-[56px]">
          {title}{accent && <> <em className="text-blush">{accent}</em></>}
        </h1>
        {subtitle && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fog">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

/** Track the pointer so `.spotlight` layers can light up under it. */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, []);
  return { ref, onMouseMove };
}

export function Panel({ title, eyebrow, actions, children, className, interactive, padded = true }: {
  title?: React.ReactNode; eyebrow?: string; actions?: React.ReactNode; children: React.ReactNode;
  className?: string; interactive?: boolean; padded?: boolean;
}) {
  const spot = useSpotlight<HTMLElement>();
  return (
    <motion.section variants={rise} ref={spot.ref} onMouseMove={interactive ? spot.onMouseMove : undefined}
      className={cn('glass group/panel relative overflow-hidden', padded && 'p-6', className)}>
      {interactive && <div className="spotlight pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/panel:opacity-100" />}
      {(title || actions || eyebrow) && (
        <div className="relative mb-5 flex items-start justify-between gap-3">
          <div>
            {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
            {title && <h2 className="text-[15px] font-semibold text-bone">{title}</h2>}
          </div>
          {actions}
        </div>
      )}
      <div className="relative">{children}</div>
    </motion.section>
  );
}

/* ---------- small pieces ---------- */
export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize', className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] || STATUS_TONES.skipped;
  const live = status === 'running' || status === 'queued' || status === 'pending';
  return (
    <Badge className={tone}>
      <span className={cn('h-1.5 w-1.5 rounded-full bg-current', live && 'animate-blink')} aria-hidden />
      {status.replace('_', ' ')}
    </Badge>
  );
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-blush', className)} aria-label={label} role="status" />;
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24" role="status">
      <Orb size={44} state="thinking" />
      <span className="eyebrow">{label}</span>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert"
      className="flex items-start gap-2.5 rounded-2xl border border-coral/25 bg-coral/[0.07] px-4 py-3 text-sm text-coral">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="text-bone/90">{message}</span>
    </motion.div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <Orb size={36} state="offline" />
      <p className="mt-5 font-display text-2xl text-bone">{title}</p>
      {children && <p className="mt-2 max-w-sm text-sm text-fog">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: {
  label: string; htmlFor: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-bone/85">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-fog">{hint}</p>}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md border border-white/10 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-fog">{children}</kbd>;
}

/** Pill tabs with a sliding highlight. */
export function Segmented<T extends string>({ options, value, onChange, id, label, size = 'md' }: {
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  value: T; onChange: (v: T) => void; id: string; label: string; size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" aria-label={label}
      className="inline-flex rounded-full border border-white/[0.07] bg-noir-950/60 p-1">
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button key={o.value} role="tab" type="button" aria-selected={active} onClick={() => onChange(o.value)}
            className={cn('relative flex items-center gap-2 rounded-full font-semibold transition-colors',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
              active ? 'text-white' : 'text-fog hover:text-bone')}>
            {active && (
              <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-crimson shadow-ember"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
            )}
            {Icon && <Icon className="relative h-4 w-4" />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Animates between numbers. */
export function CountUp({ value, decimals = 0, suffix = '' }: { value: number | null | undefined; decimals?: number; suffix?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${v.toFixed(decimals)}${suffix}`);
  useEffect(() => {
    if (value === null || value === undefined) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, reduce, mv]);
  if (value === null || value === undefined) return <span>-</span>;
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

/** Circular score meter. */
export function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? '#D64545' : score >= 50 ? '#C98F8F' : '#5A4A4F';
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}
      role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label="Lead score">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: score >= 80 ? 'drop-shadow(0 0 8px rgba(214,69,69,0.7))' : undefined }} />
      </svg>
      <div className="absolute text-center">
        <p className="font-display text-5xl leading-none text-bone"><CountUp value={score} /></p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-fog">of 100</p>
      </div>
    </div>
  );
}
