'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import Orb from '@/components/Orb';
import { ErrorBanner, Field, Segmented, Spinner } from '@/components/ui';
import { authApi, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/';
}

function LoginForm() {
  const { status, signIn, signUp } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [signupsOpen, setSignupsOpen] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authApi.config().then((c) => {
      setSignupsOpen(c.signups_open);
      if (!c.has_users) setMode('signup');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (status === 'signed-in') router.replace(next);
  }, [status, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(name, email, password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] place-items-center px-5 py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Orb size={72} state={busy ? 'thinking' : 'idle'} />
          <h1 className="mt-6 font-display text-[44px] leading-none text-bone">
            Flow<em className="text-blush">mancer</em>
          </h1>
          <p className="mt-3 text-sm text-fog">AI that reads your leads, emails and documents, and asks before it acts.</p>
        </div>

        <div className="glass-strong p-7">
          {signupsOpen && (
            <div className="mb-6 flex justify-center">
              <Segmented id="auth-mode" label="Sign in or create an account" value={mode} onChange={(m) => { setMode(m); setError(null); }}
                options={[{ value: 'signin', label: 'Sign in' }, { value: 'signup', label: 'Create account' }]} />
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <Field label="Your name" htmlFor="name">
                    <input id="name" required={mode === 'signup'} autoComplete="name" value={name}
                      onChange={(e) => setName(e.target.value)} className="field" placeholder="Sahil Sharma" />
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>
            <Field label="Email" htmlFor="email">
              <input id="email" type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} className="field" placeholder="you@company.com" />
            </Field>
            <Field label="Password" htmlFor="password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
              <div className="relative">
                <input id="password" type={show ? 'text' : 'password'} required minLength={mode === 'signup' ? 8 : 1}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} className="field pr-11" />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-fog hover:text-bone">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <ErrorBanner message={error} />
            <button type="submit" disabled={busy} className="btn-primary group w-full !py-3 text-[15px]">
              {busy ? <Spinner className="h-4 w-4 text-white" /> : null}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
              {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />}
            </button>
          </form>
          {!signupsOpen && <p className="mt-5 text-center text-xs text-fog">New accounts are turned off on this server.</p>}
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
