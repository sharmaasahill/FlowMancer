'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { CountUp, rise } from '@/components/ui';
import { cn } from '@/lib/utils';

type Variant = 'lead' | 'email' | 'document';

/* Each tile is generated from layered gradients + line art, so no image assets are needed. */
/* Glows are gradients, not blurred shapes, so hovering doesn't re-blur the tile on every frame. */
const ART: Record<Variant, { base: string; glow: string; lines: React.ReactNode }> = {
  lead: {
    base: 'radial-gradient(120% 120% at 85% 10%, #5C0A0A 0%, #1B0B0C 45%, #0E0A0B 100%)',
    glow: 'radial-gradient(45% 55% at 82% 18%, rgba(185,35,35,0.75), transparent 72%), radial-gradient(35% 45% at 30% 100%, rgba(242,184,181,0.22), transparent 72%)',
    lines: (
      <g fill="none" stroke="#F2B8B5" strokeOpacity="0.22">
        {[38, 70, 102, 134, 166, 198].map((r) => <circle key={r} cx="78%" cy="30%" r={r} />)}
        <path d="M0 260 C 160 200, 260 300, 420 220 S 640 180, 900 240" strokeOpacity="0.14" />
      </g>
    ),
  },
  email: {
    base: 'radial-gradient(130% 120% at 10% 0%, #3F0606 0%, #160C0D 50%, #0E0A0B 100%)',
    glow: 'radial-gradient(50% 55% at 18% 10%, rgba(201,143,143,0.38), transparent 72%), radial-gradient(40% 50% at 80% 95%, rgba(155,19,19,0.6), transparent 72%)',
    lines: (
      <g fill="none" stroke="#F2B8B5" strokeOpacity="0.2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M-20 ${40 + i * 26} C 120 ${10 + i * 26}, 220 ${90 + i * 26}, 420 ${40 + i * 26}`} />
        ))}
      </g>
    ),
  },
  document: {
    base: 'radial-gradient(120% 140% at 100% 100%, #7A0E0E 0%, #200B0C 45%, #0E0A0B 100%)',
    glow: 'radial-gradient(48% 58% at 78% 85%, rgba(155,19,19,0.72), transparent 72%), radial-gradient(32% 40% at 15% 8%, rgba(244,236,236,0.08), transparent 72%)',
    lines: (
      <g fill="none" stroke="#F4ECEC" strokeOpacity="0.16">
        {[0, 1, 2].map((i) => (
          <rect key={i} x={`${54 + i * 7}%`} y={22 + i * 14} width="36%" height="78%" rx="10" transform={`rotate(${-8 + i * 6})`} />
        ))}
        {[0, 1, 2, 3, 4].map((i) => <line key={i} x1="8%" x2="40%" y1={40 + i * 18} y2={40 + i * 18} strokeOpacity="0.12" />)}
      </g>
    ),
  },
};

export default function ArtTile({ variant, href, title, value, detail, className, size = 'md' }: {
  variant: Variant; href: string; title: string; value: number | null | undefined; detail: string;
  className?: string; size?: 'md' | 'lg';
}) {
  const art = ART[variant];
  return (
    <motion.div variants={rise} className={cn('min-h-[170px]', className)}>
      <Link href={href}
        className="group relative flex h-full flex-col justify-between overflow-hidden rounded-[26px] border border-white/[0.08] p-6 shadow-lift transition-[transform,box-shadow] duration-500 [transition-timing-function:cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-ember focus-visible:-translate-y-1"
        style={{ background: art.base }}>
        {/* painterly layer: drifts and grows on hover */}
        <div className="absolute inset-0 transition-transform duration-[1200ms] will-change-transform [transition-timing-function:cubic-bezier(.16,1,.3,1)] group-hover:scale-110 group-hover:rotate-1"
          style={{ background: art.glow }} aria-hidden />
        <svg className="absolute inset-0 h-full w-full transition-transform duration-[1400ms] group-hover:translate-x-2" aria-hidden>
          {art.lines}
        </svg>
        <div className="grain absolute inset-0 opacity-[0.07]" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-noir-950/85 to-transparent" aria-hidden />

        <div className="relative flex items-start justify-between">
          <span className="eyebrow !text-bone/75">{title}</span>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-white/15 text-white transition duration-500 group-hover:rotate-45 group-hover:bg-white group-hover:text-noir-900">
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <div className="relative">
          <p className={cn('font-display leading-none text-white', size === 'lg' ? 'text-7xl' : 'text-5xl')}>
            <CountUp value={value ?? 0} />
          </p>
          <p className="mt-2 text-sm text-bone/80">{detail}</p>
        </div>
      </Link>
    </motion.div>
  );
}
