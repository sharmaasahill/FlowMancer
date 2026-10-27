'use client';

import { cn } from '@/lib/utils';

export type OrbState = 'idle' | 'thinking' | 'done' | 'error' | 'offline';

/**
 * The AI's "face": a slowly turning crimson sphere.
 * Thinking speeds it up and adds a breathing halo; errors cool it down.
 */
export default function Orb({ size = 48, state = 'idle', className }: { size?: number; state?: OrbState; className?: string }) {
  const thinking = state === 'thinking';
  const dim = state === 'error' || state === 'offline';
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }} aria-hidden>
      {/* halo */}
      <span className={cn('absolute inset-0 rounded-full bg-crimson/50 blur-xl transition-opacity duration-700',
        dim ? 'opacity-10' : thinking ? 'opacity-90' : 'opacity-45')} />
      {thinking && <span className="absolute inset-0 animate-breathe rounded-full border border-blush/60" />}
      {/* body */}
      <span className={cn('absolute inset-0 overflow-hidden rounded-full transition-[filter] duration-700',
        dim && 'grayscale-[0.7] brightness-50')}>
        <span className={cn('absolute -inset-[30%] rounded-full', thinking ? 'animate-spin-fast' : 'animate-spin-slow')}
          style={{ background: 'conic-gradient(from 0deg, #9B1313, #F2B8B5, #5C0A0A, #D64545, #2A0404, #9B1313)' }} />
        <span className="absolute inset-[8%] rounded-full blur-[6px]"
          style={{ background: 'radial-gradient(circle at 32% 28%, rgba(255,235,235,0.95), rgba(214,69,69,0.4) 34%, transparent 62%)' }} />
        <span className="absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle at 70% 80%, rgba(7,4,5,0.75), transparent 55%)' }} />
        <span className="grain absolute inset-0 rounded-full opacity-25 mix-blend-overlay" />
      </span>
      {state === 'done' && <span className="absolute -bottom-0.5 -right-0.5 h-[28%] w-[28%] rounded-full border-2 border-noir-900 bg-jade" />}
    </span>
  );
}
