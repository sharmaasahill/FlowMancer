'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MailCheck } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { ErrorBanner, Field, PageHeader, Panel, PasswordInput, Spinner, stagger } from '@/components/ui';
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
  return { busy, error, setError, run };
}

/** Emails the signed-in user a link to set or reset their password. */
function EmailLinkButton({ email, label, enabled }: { email: string; label: string; enabled: boolean }) {
  const action = useAction();
  const [sent, setSent] = useState(false);
  if (!enabled) {
    return <p className="text-xs text-fog">Email isn&apos;t set up on this server, so a link can&apos;t be sent.</p>;
  }
  if (sent) {
    return (
      <p className="flex gap-2 text-sm text-bone/90" role="status">
        <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-jade" aria-hidden />
        We&apos;ve sent a link to {email}. It expires in 30 minutes. Check Spam if you don&apos;t see it.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <button type="button" disabled={action.busy} className="btn-ghost !py-2 text-sm"
        onClick={() => action.run(async () => { await authApi.forgotPassword(email); setSent(true); })}>
        {action.busy && <Spinner className="h-4 w-4" />}{label}
      </button>
      <ErrorBanner message={action.error} />
    </div>
  );
}

export default function SettingsPage() {
  const { user, setUser, signOut } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const profile = useAction();
  const password = useAction();
  const removal = useAction();

  useEffect(() => {
    authApi.config().then((c) => setEmailEnabled(c.password_reset)).catch(() => {});
  }, []);

  if (!user) return null;
  const locked = user.is_demo;
  const nameChanged = !!name.trim() && name.trim() !== user.name;

  const saveName = (e: React.FormEvent) => {
    e.preventDefault();
    profile.run(async () => {
      const updated = await authApi.updateMe(name);
      setUser(updated);
      setName(updated.name);
      toast({ tone: 'success', title: 'Name updated' });
    });
  };

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== again) {
      password.setError("The two new passwords don't match.");
      return;
    }
    password.run(async () => {
      setUser(await authApi.changePassword(current, next));
      setCurrent('');
      setNext('');
      setAgain('');
      toast({ tone: 'success', title: 'Password changed' });
    });
  };

  const deleteAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm('Delete your account and everything in it? This can\'t be undone.')) return;
    removal.run(async () => {
      await authApi.deleteAccount(confirmEmail, deletePassword);
      signOut();
    });
  };

  return (
    <div className="space-y-8 pt-4">
      <PageHeader eyebrow="Settings" title="Your" accent="account."
        subtitle={locked
          ? 'This is the shared demo account, so these settings are locked. Create your own free account to change them.'
          : 'Change your name or password, or delete the account and everything in it.'} />

      <motion.div variants={stagger()} initial="hidden" animate="show" className="grid items-start gap-6 xl:grid-cols-2">
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
            <div className="flex gap-2">
              <button type="submit" disabled={locked || profile.busy || !nameChanged} className="btn-primary">
                {profile.busy && <Spinner className="h-4 w-4 text-white" />}Save name
              </button>
              <button type="button" disabled={locked || profile.busy || name === user.name} className="btn-quiet"
                onClick={() => { setName(user.name); profile.setError(null); }}>
                Cancel
              </button>
            </div>
          </form>
        </Panel>

        <Panel eyebrow="Security" title={user.has_password ? 'Change password' : 'Set a password'}>
          {user.has_password ? (
            <form onSubmit={savePassword} className="space-y-4">
              <Field label="Current password" htmlFor="current">
                <PasswordInput id="current" value={current} onChange={setCurrent} disabled={locked} />
              </Field>
              <Field label="New password" htmlFor="new" hint="At least 8 characters.">
                <PasswordInput id="new" value={next} onChange={setNext} autoComplete="new-password" minLength={8} disabled={locked} />
              </Field>
              <Field label="Type the new password again" htmlFor="again">
                <PasswordInput id="again" value={again} onChange={setAgain} autoComplete="new-password" minLength={8} disabled={locked} />
              </Field>
              <ErrorBanner message={password.error} />
              <button type="submit" disabled={locked || password.busy} className="btn-primary">
                {password.busy && <Spinner className="h-4 w-4 text-white" />}Change password
              </button>
              {!locked && (
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="mb-2 text-xs text-fog">Forgot your current password?</p>
                  <EmailLinkButton email={user.email} label="Email me a reset link" enabled={emailEnabled} />
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-fog">
                You sign in with Google, so there&apos;s no current password to check. To prove it&apos;s you, we&apos;ll
                email a link to <span className="text-bone">{user.email}</span>. Open it to choose your password and
                type it twice. After that you can also sign in with your email.
              </p>
              <EmailLinkButton email={user.email} label="Email me a link to set a password" enabled={emailEnabled} />
            </div>
          )}
        </Panel>

        <Panel eyebrow="Danger zone" title="Delete account" className="xl:col-span-2">
          <form onSubmit={deleteAccount} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <p className="text-sm text-fog md:col-span-3">
              Deletes your account, runs, approvals, workflows, knowledge documents and connected integrations.
              This can&apos;t be undone.
              {!user.has_password && !locked && ' You need a password to confirm this, so set one first (above).'}
            </p>
            <Field label="Type your email to confirm" htmlFor="confirm">
              <input id="confirm" required value={confirmEmail} disabled={locked} placeholder={user.email}
                onChange={(e) => setConfirmEmail(e.target.value)} className="field" />
            </Field>
            <Field label="Current password" htmlFor="delete-password">
              <PasswordInput id="delete-password" value={deletePassword} onChange={setDeletePassword}
                disabled={locked || !user.has_password} />
            </Field>
            <button type="submit" className="btn-danger"
              disabled={locked || removal.busy || !user.has_password || !deletePassword
                || confirmEmail.trim().toLowerCase() !== user.email}>
              {removal.busy && <Spinner className="h-4 w-4" />}Delete account
            </button>
            <div className="md:col-span-3"><ErrorBanner message={removal.error} /></div>
          </form>
        </Panel>
      </motion.div>
    </div>
  );
}
