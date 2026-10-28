'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { CheckSquare, Menu, Search, X } from 'lucide-react';
import AssistantPanel from '@/components/assistant/AssistantPanel';
import { AssistantProvider, useAssistant } from '@/components/assistant/AssistantProvider';
import Orb from '@/components/Orb';
import Backdrop from '@/components/shell/Backdrop';
import CommandPalette from '@/components/shell/CommandPalette';
import Sidebar, { Wordmark } from '@/components/shell/Sidebar';
import { ToastProvider } from '@/components/Toast';
import { Kbd, Loading } from '@/components/ui';
import WakingHint from '@/components/WakingHint';
import { AuthProvider, useAuth } from '@/lib/auth';
import { SystemProvider, useSystem } from '@/lib/system';
import { cn } from '@/lib/utils';

// Pages anyone can open without signing in
const PUBLIC_PATHS = ['/login', '/about', '/privacy', '/terms'];

function TopBar({ onSearch, onMenu }: { onSearch: () => void; onMenu: () => void }) {
  const { stats } = useSystem();
  const { toggle, busy } = useAssistant();
  const pending = stats?.totals.pending_approvals ?? 0;
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 px-5 py-4 lg:px-10">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-noir-900/90 via-noir-900/60 to-transparent backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_60%,transparent)]" />
      <button type="button" onClick={onMenu} aria-label="Open menu"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-bone lg:hidden">
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <div className="lg:hidden"><Wordmark /></div>

      <button type="button" onClick={onSearch} aria-label="Search or jump to"
        className="ml-auto flex h-10 shrink-0 items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-fog transition hover:border-white/[0.14] hover:bg-white/[0.05] sm:w-full sm:max-w-xs sm:px-4 lg:ml-0">
        <Search className="h-4 w-4" aria-hidden />
        <span className="hidden flex-1 text-left sm:inline">Search or jump to...</span>
        <span className="hidden gap-1 sm:flex"><Kbd>{mac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd></span>
      </button>

      <button type="button" onClick={toggle} aria-label="Ask FlowMancer"
        className="group flex h-10 shrink-0 items-center gap-2 rounded-full border border-crimson-400/30 bg-crimson/15 pl-1.5 pr-1.5 text-sm font-semibold text-bone transition hover:border-crimson-400/60 hover:bg-crimson/25 sm:pr-4 lg:ml-auto">
        <Orb size={28} state={busy ? 'thinking' : 'idle'} />
        <span className="hidden sm:inline">Ask FlowMancer</span>
        <span className="hidden gap-1 xl:flex"><Kbd>{mac ? '⌘' : 'Ctrl'}</Kbd><Kbd>J</Kbd></span>
      </button>

      <Link href="/approvals" aria-label={`Approvals, ${pending} pending`}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] text-fog transition hover:text-bone">
        <CheckSquare className="h-[18px] w-[18px]" aria-hidden />
        {pending > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-crimson px-1 text-[10px] font-bold text-white shadow-ember">
            {pending}
          </span>
        )}
      </Link>
    </div>
  );
}

function Workspace({ children }: { children: React.ReactNode }) {
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const { toggle, setOpen } = useAssistant();

  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (key === 'j') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <>
      <div className="flex h-[100dvh] p-0 lg:p-4">
        <div className="flex min-w-0 flex-1 overflow-hidden border-white/[0.06] bg-noir-900/55 shadow-lift backdrop-blur-2xl lg:rounded-[30px] lg:border">
          <aside className="hidden w-[256px] shrink-0 border-r border-white/[0.05] py-5 lg:block">
            <Sidebar />
          </aside>
          <main id="main" className="relative min-w-0 flex-1 overflow-y-auto">
            <TopBar onSearch={() => setPalette(true)} onMenu={() => setDrawer(true)} />
            <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-2 lg:px-10">{children}</div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-noir-950/70 backdrop-blur-sm" onClick={() => setDrawer(false)} aria-hidden />
            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className={cn('glass-strong absolute inset-y-3 left-3 w-[270px] !rounded-[26px] py-5')}
              role="dialog" aria-modal="true" aria-label="Menu">
              <button type="button" onClick={() => setDrawer(false)} className="btn-quiet absolute right-3 top-4 !p-2" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
              <Sidebar onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <CommandPalette open={palette} onClose={() => setPalette(false)} onAsk={() => setOpen(true)} />
      <AssistantPanel />
    </>
  );
}

function Unreachable() {
  const { retry, signOut } = useAuth();
  return (
    <div className="grid h-[100dvh] place-items-center px-6">
      <div className="glass-strong flex max-w-md flex-col items-center gap-4 p-8 text-center">
        <Orb size={56} state="offline" />
        <h1 className="font-display text-3xl text-bone">Can&apos;t reach the server</h1>
        <p className="text-sm text-fog">FlowMancer&apos;s backend didn&apos;t answer. It may be starting up or offline. You&apos;re still signed in.</p>
        <div className="flex gap-2">
          <button type="button" onClick={retry} className="btn-primary">Try again</button>
          <button type="button" onClick={signOut} className="btn-ghost">Sign out</button>
        </div>
      </div>
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (status === 'signed-out' && !isPublic) {
      router.replace(`/login${pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : ''}`);
    }
  }, [status, isPublic, pathname, router]);

  if (isPublic) return <>{children}</>;
  if (status === 'unreachable') return <Unreachable />;
  if (status !== 'signed-in') {
    return (
      <div className="grid h-[100dvh] place-items-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loading label="Signing you in" />
          <WakingHint />
        </div>
      </div>
    );
  }
  return (
    <SystemProvider>
      <AssistantProvider>
        <Workspace>{children}</Workspace>
      </AssistantProvider>
    </SystemProvider>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <ToastProvider>
          <Backdrop />
          <Gate>{children}</Gate>
        </ToastProvider>
      </AuthProvider>
    </MotionConfig>
  );
}
