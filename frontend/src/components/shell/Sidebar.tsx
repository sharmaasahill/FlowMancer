'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import Orb from '@/components/Orb';
import { CountUp } from '@/components/ui';
import { isActive, NAV } from '@/components/shell/nav';
import { useAuth } from '@/lib/auth';
import { useSystem } from '@/lib/system';
import { cn } from '@/lib/utils';

export function Wordmark() {
  return (
    <Link href="/" className="group flex items-center gap-3 rounded-2xl px-2 py-1">
      <Orb size={30} />
      <span className="font-display text-[26px] leading-none tracking-tight text-bone">
        Flow<em className="text-blush">mancer</em>
      </span>
    </Link>
  );
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { stats, integrations } = useSystem();
  const pending = stats?.totals.pending_approvals ?? 0;
  const ai = integrations?.ai;
  const { user, signOut } = useAuth();
  const initials = (user?.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-8 pt-2"><Wordmark /></div>

      <nav aria-label="Main" className="flex-1 space-y-7 overflow-y-auto px-3">
        {NAV.map((section) => (
          <div key={section.group}>
            <p className="eyebrow mb-2 px-3 !text-[10px] !text-ash">{section.group}</p>
            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, badge }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
                      className={cn('relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors',
                        active ? 'text-bone' : 'text-fog hover:text-bone')}>
                      {active && (
                        <motion.span layoutId="nav-active" transition={{ type: 'spring', stiffness: 450, damping: 36 }}
                          className="absolute inset-0 rounded-2xl border border-white/[0.08] bg-white/[0.06] shadow-glass">
                          <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-crimson-400 shadow-[0_0_12px_#D64545]" />
                        </motion.span>
                      )}
                      <Icon className={cn('relative h-[18px] w-[18px]', active && 'text-blush')} aria-hidden />
                      <span className="relative flex-1 font-medium">{label}</span>
                      {badge && pending > 0 && (
                        <span className="relative rounded-full bg-crimson px-2 py-0.5 text-[11px] font-bold text-white shadow-ember"
                          aria-label={`${pending} pending`}>
                          <CountUp value={pending} />
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mx-3 mb-2 mt-6 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
        <Link href="/integrations" onClick={onNavigate} className="flex items-center gap-3 p-3 transition hover:bg-white/[0.04]">
          <Orb size={30} state={!ai ? 'thinking' : ai.reachable ? 'idle' : 'offline'} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-bone">{ai ? ai.model.replace(/ \(.*\)$/, '') : 'Connecting...'}</p>
            <p className={cn('flex items-center gap-1.5 text-xs', ai?.reachable ? 'text-jade' : 'text-fog')}>
              <span className={cn('h-1.5 w-1.5 rounded-full bg-current', ai?.reachable && 'animate-blink')} aria-hidden />
              {ai ? (ai.reachable ? 'AI online' : ai.detail) : 'Checking AI'}
            </p>
          </div>
        </Link>
        {user && (
          <div className="flex items-center gap-3 border-t border-white/[0.06] p-3">
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-crimson-500 to-crimson-800 text-[11px] font-bold text-white" aria-hidden>
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-bone">{user.name}</p>
              <p className="truncate text-xs text-fog">{user.email}</p>
            </div>
            <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out"
              className="rounded-full p-2 text-fog transition hover:bg-white/[0.06] hover:text-bone">
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
