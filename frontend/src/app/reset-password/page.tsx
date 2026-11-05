'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import Orb from '@/components/Orb';
import { ErrorBanner, Field, PasswordInput, Spinner } from '@/components/ui';
import { authApi, errorMessage } from '@/lib/api';

function ResetForm() {
  const params = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Keep the token in memory and take it out of the address bar and browser history
  useEffect(() => {
    const t = params.get('token');
    if (t) {
      setToken(t);
      window.history.replaceState(null, '', '/reset-password');
    }
  }, [params]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword(token || '', password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center px-5 py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Orb size={72} state={done ? 'done' : busy ? 'thinking' : 'idle'} />
          <h1 className="mt-6 font-display text-[44px] leading-none text-bone">
            Flow<em className="text-blush">mancer</em>
          </h1>
        </div>

        <div className="glass-strong p-7">
          {done ? (
            <div className="space-y-4 text-center" role="status">
              <CheckCircle2 className="mx-auto h-10 w-10 text-jade" aria-hidden />
              <h2 className="text-lg font-semibold text-bone">Your password has been changed</h2>
              <p className="text-sm leading-relaxed text-fog">
                Go back to the FlowMancer tab and refresh the page, then sign in with your new password.
                You can close this tab.
              </p>
              <Link href="/login" className="btn-ghost w-full !py-2.5">Or sign in here</Link>
            </div>
          ) : !token ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-bone">This link is incomplete</h2>
              <p className="text-sm text-fog">Open the link from the email again, or ask for a new one.</p>
              <Link href="/login" className="btn-primary w-full !py-2.5">Go to sign in</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <h2 className="text-lg font-semibold text-bone">Choose a new password</h2>
              <Field label="New password" htmlFor="new-password" hint="At least 8 characters.">
                <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
              </Field>
              <Field label="Type it again" htmlFor="confirm-password">
                <PasswordInput id="confirm-password" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={8} />
              </Field>
              <ErrorBanner message={error} />
              <button type="submit" disabled={busy} className="btn-primary w-full !py-3 text-[15px]">
                {busy && <Spinner className="h-4 w-4 text-white" />}Change password
              </button>
              <p className="text-center text-xs text-fog">
                Link expired? <Link href="/login" className="text-blush hover:underline">Ask for a new one</Link>
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
