'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '@/components/Toast';
import { ErrorBanner, Field, PageHeader, Panel, Spinner, stagger } from '@/components/ui';
import { authApi, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Runs `fn` with a busy flag and an error message for one form. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export default function SettingsPage() {
  const { user, setUser, signOut } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const profile = useAction();
  const password = useAction();
  const removal = useAction();
  if (!user) return null;
  const locked = user.is_demo;

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    profile.run(async () => {
      setUser(await authApi.updateMe(name));
      toast({ tone: 'success', title: 'Name updated' });
    });
  };

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    password.run(async () => {
      setUser(await authApi.changePassword(user.has_password ? current : null, next));
      setCurrent('');
      setNext('');
      toast({ tone: 'success', title: user.has_password ? 'Password changed' : 'Password set' });
    });
  };

  const deleteAccount = (e: React.FormEvent) => {
    e.preventDefault();
    removal.run(async () => {
      await authApi.deleteAccount(confirmEmail, user.has_password ? deletePassword : null);
      signOut();
    });
  };

  return (
    <div className="space-y-8 pt-4">
      <PageHeader eyebrow="Settings" title="Your" accent="account."
        subtitle={locked
          ? 'This is the shared demo account, so these settings are locked. Create your own free account to change them.'
          : 'Change your name or password, or delete the account and everything in it.'} />

      <motion.div variants={stagger()} initial="hidden" animate="show" className="grid gap-6 xl:grid-cols-2">
        <Panel eyebrow="Profile" title="Name">
          <form onSubmit={saveName} className="space-y-4">
            <Field label="Email" htmlFor="email" hint={user.google_linked ? 'Linked to Google sign-in.' : undefined}>
              <input id="email" value={user.email} disabled className="field opacity-70" />
            </Field>
            <Field label="Your name" htmlFor="name">
              <input id="name" required maxLength={120} value={name} disabled={locked}
                onChange={(e) => setName(e.target.value)} className="field" />
            </Field>
            <ErrorBanner message={profile.error} />
            <button type="submit" disabled={locked || profile.busy || !name.trim() || name.trim() === user.name}
              className="btn-primary">
              {profile.busy && <Spinner className="h-4 w-4 text-white" />}Save name
            </button>
          </form>
        </Panel>

        <Panel eyebrow="Security" title={user.has_password ? 'Change password' : 'Set a password'}>
          <form onSubmit={savePassword} className="space-y-4">
            {!user.has_password && (
              <p className="text-sm text-fog">You sign in with Google. Set a password to also sign in with your email.</p>
            )}
            {user.has_password && (
              <Field label="Current password" htmlFor="current">
                <input id="current" type="password" required autoComplete="current-password" value={current}
                  disabled={locked} onChange={(e) => setCurrent(e.target.value)} className="field" />
              </Field>
            )}
            <Field label="New password" htmlFor="new" hint="At least 8 characters.">
              <input id="new" type="password" required minLength={8} autoComplete="new-password" value={next}
                disabled={locked} onChange={(e) => setNext(e.target.value)} className="field" />
            </Field>
            <ErrorBanner message={password.error} />
            <button type="submit" disabled={locked || password.busy} className="btn-primary">
              {password.busy && <Spinner className="h-4 w-4 text-white" />}
              {user.has_password ? 'Change password' : 'Set password'}
            </button>
          </form>
        </Panel>

        <Panel eyebrow="Danger zone" title="Delete account" className="xl:col-span-2">
          <form onSubmit={deleteAccount} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <p className="text-sm text-fog md:col-span-3">
              Deletes your account, runs, approvals, workflows, knowledge documents and connected integrations.
              This can&apos;t be undone.
            </p>
            <Field label="Type your email to confirm" htmlFor="confirm">
              <input id="confirm" required value={confirmEmail} disabled={locked} placeholder={user.email}
                onChange={(e) => setConfirmEmail(e.target.value)} className="field" />
            </Field>
            {user.has_password ? (
              <Field label="Password" htmlFor="delete-password">
                <input id="delete-password" type="password" required autoComplete="current-password"
                  value={deletePassword} disabled={locked} onChange={(e) => setDeletePassword(e.target.value)}
                  className="field" />
              </Field>
            ) : <span />}
            <button type="submit" disabled={locked || removal.busy || confirmEmail.trim().toLowerCase() !== user.email}
              className="btn-danger">
              {removal.busy && <Spinner className="h-4 w-4" />}Delete account
            </button>
            <div className="md:col-span-3"><ErrorBanner message={removal.error} /></div>
          </form>
        </Panel>
      </motion.div>
    </div>
  );
}
