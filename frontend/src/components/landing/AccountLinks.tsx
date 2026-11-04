'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { API_BASE_URL, authApi, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

/** Signed-in visitors go straight to their dashboard; everyone else is invited to sign in or sign up. */
function useSignedIn() {
  const { status } = useAuth();
  return status === 'signed-in' || status === 'unreachable';
}

export function HeaderAccount() {
  const signedIn = useSignedIn();
  if (signedIn) return <Link href="/dashboard" className="btn-solid !px-4 !py-2 !text-[13px]">Open dashboard</Link>;
  return (
    <>
      <Link href="/login" className="hidden px-3 py-2 text-[14px] text-fog transition-colors hover:text-bone sm:inline">Sign in</Link>
      <Link href="/login?mode=signup" className="btn-solid !px-4 !py-2 !text-[13px]">Try it free</Link>
    </>
  );
}

export function PrimaryCta({ className, label = 'Try it free' }: { className?: string; label?: string }) {
  const signedIn = useSignedIn();
  return (
    <Link href={signedIn ? '/dashboard' : '/login?mode=signup'} className={cn('btn-solid group !px-6 !py-3 !text-[15px]', className)}>
      {signedIn ? 'Open your dashboard' : label}
      <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

let demoEnabled: Promise<boolean> | null = null;

/** "Try the demo": signs straight into the shared demo account. Hidden if the server has no demo. */
export function TryDemo({ className }: { className?: string }) {
  const signedIn = useSignedIn();
  const { signInDemo } = useAuth();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    demoEnabled = demoEnabled || authApi.config().then((c) => c.demo_enabled).catch(() => false);
    demoEnabled.then(setEnabled);
  }, []);

  if (signedIn || !enabled) return null;
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInDemo();
      router.push('/dashboard');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={start} disabled={busy} className={cn('btn-line !px-6 !py-3 !text-[15px]', className)}>
        {busy && <Spinner className="h-4 w-4" />}Try the demo
      </button>
      {error && <span role="alert" className="text-[12px] text-coral">{error}</span>}
    </span>
  );
}

/**
 * The free server sleeps when nobody uses it. Ping it as soon as someone opens a public page,
 * so it is awake by the time they sign in.
 */
export function WakeServer() {
  useEffect(() => {
    fetch(`${API_BASE_URL}/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
  }, []);
  return null;
}
