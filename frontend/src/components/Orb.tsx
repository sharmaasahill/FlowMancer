'use client';

import { cn } from '@/lib/utils';

export type OrbState = 'idle' | 'thinking' | 'done' | 'error' | 'offline';

const HALO = 'radial-gradient(circle, rgba(155,19,19,0.55) 0%, rgba(155,19,19,0.18) 45%, transparent 70%)';
const SPIN = 'conic-gradient(from 0deg, #9B1313, #F2B8B5, #5C0A0A, #D64545, #2A0404, #9B1313)';
const SHINE = 'radial-gradient(circle at 32% 28%, rgba(255,235,235,0.9), rgba(214,69,69,0.35) 30%, transparent 58%)';
const SHADE = 'radial-gradient(circle at 70% 80%, rgba(7,4,5,0.75), transparent 55%)';

/**
 * The AI's "face": a slowly turning crimson sphere.
 * Thinking speeds it up and adds a breathing ring; errors cool it down.
 * Only the inner gradient rotates (a transform the GPU handles on its own); the halo and
 * highlights are gradients rather than blur filters, so nothing is re-blurred per frame.
 */
export default function Orb({ size = 48, state = 'idle', className }: { size?: number; state?: OrbState; className?: string }) {
  const thinking = state === 'thinking';
  const dim = state === 'error' || state === 'offline';
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }} aria-hidden>
      {/* halo */}
      <span className={cn('absolute -inset-[35%] rounded-full transition-opacity duration-700',
        dim ? 'opacity-[0.15]' : thinking ? 'opacity-100' : 'opacity-70')} style={{ background: HALO }} />
      {thinking && <span className="absolute inset-0 animate-breathe rounded-full border border-blush/60" />}
      {/* body */}
      <span className={cn('absolute inset-0 overflow-hidden rounded-full [transform:translateZ(0)]', dim && 'opacity-45 saturate-[0.3]')}>
        <span className={cn('absolute -inset-[30%] rounded-full will-change-transform', thinking ? 'animate-spin-fast' : 'animate-spin-slow')}
          style={{ background: SPIN }} />
        <span className="absolute inset-0 rounded-full" style={{ background: SHINE }} />
        <span className="absolute inset-0 rounded-full" style={{ background: SHADE }} />
      </span>
      {state === 'done' && <span className="absolute -bottom-0.5 -right-0.5 h-[28%] w-[28%] rounded-full border-2 border-noir-900 bg-jade" />}
    </span>
  );
}
