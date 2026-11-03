'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
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
