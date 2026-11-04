'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Check, Copy, Globe, Inbox, KeyRound, MessageSquare, RefreshCw, Webhook } from 'lucide-react';
import Orb from '@/components/Orb';
import { useToast } from '@/components/Toast';
import { ErrorBanner, Field, Loading, PageHeader, Panel, rise, Spinner, stagger } from '@/components/ui';
import { API_BASE_URL, authApi, connectionsApi, errorMessage, systemApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSystem } from '@/lib/system';
import type { ConnectionStatus, Provider } from '@/types';
import { cn, timeAgo } from '@/lib/utils';

interface ProviderDef {
  id: Provider;
  icon: typeof Globe;
  name: string;
  detail: string;
  fields: { key: string; label: string; type?: string; placeholder?: string }[];
  help: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'slack', icon: MessageSquare, name: 'Slack',
    detail: 'Hot leads, urgent emails and approved documents are posted to a channel.',
    fields: [{ key: 'webhook_url', label: 'Incoming webhook URL', placeholder: 'https://hooks.slack.com/services/...' }],
    help: 'In Slack: Apps > Incoming Webhooks > Add to Slack, pick a channel and copy the URL. A test message is posted when you connect.',
  },
  {
    id: 'hubspot', icon: Building2, name: 'HubSpot CRM', detail: 'Approved leads become contacts.',
    fields: [{ key: 'token', label: 'Service Key', type: 'password', placeholder: 'pat-na1-...' }],
    help: 'In HubSpot: Development > Keys > Service Keys > Create, with the crm.objects.contacts.read and .write scopes.',
  },
  {
    id: 'gmail', icon: Inbox, name: 'Gmail',
    detail: 'Reads unread email, saves reply drafts, and sends replies you choose to send.',
    fields: [{ key: 'email', label: 'Gmail address', type: 'email', placeholder: 'you@gmail.com' },
      { key: 'app_password', label: 'App password', type: 'password', placeholder: '16 letters' }],
    help: 'Turn on 2-Step Verification, then create an app password at myaccount.google.com/apppasswords. Your normal password won\'t work.',
  },
  {
    id: 'webhook', icon: Webhook, name: 'Webhook (Zapier · n8n · Make)',
    detail: 'Approved documents are sent here. Workflows can call their own URLs too.',
    fields: [{ key: 'url', label: 'Webhook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/...' }],
    help: 'A test event {"event": "flowmancer.test"} is sent when you connect.',
  },
];

function StatusDot({ on, text }: { on: boolean; text: string }) {
  return (
    <span className={cn('flex items-center gap-1.5 text-xs font-medium', on ? 'text-jade' : 'text-fog')}>
      <span className={cn('h-1.5 w-1.5 rounded-full bg-current', on && 'animate-blink')} aria-hidden />{text}
    </span>
  );
}

function Card({ icon: Icon, on, status, children }: {
  icon: typeof Globe; on: boolean; status: string; children: React.ReactNode;
}) {
  return (
    <motion.div variants={rise} className={cn('glass relative overflow-hidden !rounded-[22px] p-5', on && 'border-crimson-400/25')}>
      {on && <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full" style={{ background: 'radial-gradient(circle, rgba(155,19,19,0.3), transparent 70%)' }} aria-hidden />}
      <div className="relative flex items-start justify-between">
        <span className={cn('grid h-11 w-11 place-items-center rounded-2xl border', on ? 'border-crimson-400/40 bg-crimson/25 text-blush' : 'border-white/[0.07] bg-white/[0.03] text-fog')}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <StatusDot on={on} text={status} />
      </div>
      <div className="relative">{children}</div>
    </motion.div>
  );
}

function ConnectCard({ def, status, canConnect, onChanged }: {
  def: ProviderDef; status: ConnectionStatus; canConnect: boolean; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const own = status.source === 'account';

  const act = async (kind: 'connect' | 'disconnect') => {
    if (kind === 'disconnect' && !window.confirm(`Disconnect ${def.name}? Actions that use it will be skipped.`)) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'connect') await connectionsApi.connect(def.id, values);
      else await connectionsApi.disconnect(def.id);
      toast({ tone: 'success', title: kind === 'connect' ? `${def.name} connected` : `${def.name} disconnected` });
      setOpen(false);
      setValues({});
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card icon={def.icon} on={status.configured}
      status={own ? 'Connected' : status.source === 'server' ? 'Set on the server' : 'Not connected'}>
      <p className="mt-4 font-semibold text-bone">{def.name}</p>
      <p className="mt-1 text-sm text-fog">{def.detail}</p>
      {status.configured && status.label && (
        <p className="mt-2 font-mono text-[11px] text-bone/80">
          {status.label}{own && status.updated_at && <span className="text-ash"> · {timeAgo(status.updated_at)}</span>}
        </p>
      )}
      {canConnect && !open && (
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setOpen(true)} className="btn-ghost !py-1.5 text-xs">
            {own ? 'Change' : 'Connect'}
          </button>
          {own && (
            <button type="button" onClick={() => act('disconnect')} disabled={!!busy} className="btn-quiet !py-1.5 text-xs">
              {busy === 'disconnect' && <Spinner className="h-3.5 w-3.5" />}Disconnect
            </button>
          )}
        </div>
      )}
      {open && (
        <form onSubmit={(e) => { e.preventDefault(); act('connect'); }} className="mt-4 space-y-3">
          {def.fields.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`${def.id}-${f.key}`}>
              <input id={`${def.id}-${f.key}`} type={f.type || 'text'} required autoComplete="off" placeholder={f.placeholder}
                value={values[f.key] || ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="field" />
            </Field>
          ))}
          <p className="text-xs leading-relaxed text-fog">{def.help} Saved encrypted, and used only for your account.</p>
          <ErrorBanner message={error} />
          <div className="flex gap-2">
            <button type="submit" disabled={!!busy} className="btn-primary !py-2 text-sm">
              {busy === 'connect' && <Spinner className="h-4 w-4 text-white" />}{busy === 'connect' ? 'Testing...' : 'Test and connect'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(null); }} className="btn-quiet !py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}
      {!open && error && <div className="mt-3"><ErrorBanner message={error} /></div>}
    </Card>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-noir-950/80 p-4 pr-20 font-mono text-xs leading-relaxed text-bone/85">{code}</pre>
      <button type="button" className="btn-quiet absolute right-2 top-2 !px-2.5 !py-1 text-xs" aria-label="Copy code"
        onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? <Check className="h-3.5 w-3.5 text-jade" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function IntegrationsPage() {
  const { integrations: info, error: loadError, refresh } = useSystem();
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [revealKey, setRevealKey] = useState(false);
  const toast = useToast();
  const { setUser } = useAuth();

  const rotate = async () => {
    if (!confirm('Create a new trigger key? Forms and webhooks using the old key will stop working until you update them.')) return;
    setRotating(true);
    setError(null);
    try {
      setUser(await authApi.rotateTriggerKey());
      await refresh();
      toast({ tone: 'success', title: 'New trigger key created', detail: 'Update your website form and webhooks.' });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRotating(false);
    }
  };

  const poll = async () => {
    setPolling(true);
    setError(null);
    try {
      const r = await systemApi.pollInbox();
      toast({ tone: 'success', title: `Fetched ${r.fetched} unread email${r.fetched === 1 ? '' : 's'}`, detail: r.fetched ? 'They are processing now. See History.' : undefined });
      refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPolling(false);
    }
  };

  if (!info) return loadError ? <div className="pt-4"><ErrorBanner message={loadError} /></div> : <Loading />;
  const m = info.mailbox;
  const key = info.triggers.key;
  const shownKey = revealKey ? key : `${key.slice(0, 8)}${'•'.repeat(18)}`;

  return (
    <div className="space-y-8 pt-4">
      <PageHeader eyebrow="Integrations" title="Wired" accent="in."
        subtitle="Connect your own Slack, HubSpot and Gmail. Each account uses only its own connections. Anything not connected is skipped, never broken." />
      {!info.can_connect && (
        <p className="rounded-2xl border border-amber/25 bg-amber/[0.06] p-4 text-sm text-bone/90">
          This is the shared demo account, so connecting integrations is turned off and actions that need them are
          recorded as skipped. Create your own free account to connect your Slack, HubSpot and Gmail.
        </p>
      )}
      <ErrorBanner message={error} />

      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={rise} className="glass relative overflow-hidden p-7">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-70" aria-hidden
            style={{ background: 'radial-gradient(60% 80% at 80% 50%, rgba(155,19,19,0.45), transparent 70%)' }} />
          <div className="relative flex flex-wrap items-center gap-6">
            <Orb size={76} state={info.ai.reachable ? 'idle' : 'offline'} />
            <div className="min-w-0 flex-1">
              <p className="eyebrow">AI model · {info.ai.provider}</p>
              <p className="mt-2 font-display text-4xl leading-none text-bone">{info.ai.model.replace(/ \(.*\)$/, '')}</p>
              <p className={cn('mt-2 text-sm', info.ai.reachable ? 'text-jade' : 'text-coral')}>{info.ai.detail}</p>
            </div>
            {info.ai.fallbacks.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-noir-950/40 px-4 py-3 text-sm">
                <p className="eyebrow !text-[10px]">If busy, falls back to</p>
                {info.ai.fallbacks.map((f) => <p key={f} className="mt-1 text-bone">{f}</p>)}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={stagger(0.05)} className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PROVIDERS.map((def) => (
            <ConnectCard key={def.id} def={def} status={info[def.id]} canConnect={info.can_connect} onChanged={refresh} />
          ))}
          <Card icon={Globe} on={info.research.enabled} status={info.research.enabled ? 'On' : 'Off'}>
            <p className="mt-4 font-semibold text-bone">Lead research</p>
            <p className="mt-1 text-sm text-fog">{info.research.enabled ? info.research.engine : 'Turned off on this server'}</p>
          </Card>
        </motion.div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel eyebrow="Trigger" title="Inbox" actions={
            <button type="button" onClick={poll} disabled={!m.configured || polling} className="btn-ghost !py-1.5 text-xs">
              {polling ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />} Check now
            </button>
          }>
            <div className="space-y-2 text-sm text-fog">
              <p>Unread mail in your connected Gmail is processed and marked read. Approved replies are saved to Drafts, or sent if you choose Send now.</p>
              {m.configured
                ? <p>Reading <span className="text-bone">{m.user}</span>{m.source === 'server' && ' (the server\'s mailbox, set in backend/.env)'}.</p>
                : <p>Connect Gmail above to use it.</p>}
              <p>Auto-check: <span className="text-bone">{m.auto_poll_seconds > 0 ? `every ${m.auto_poll_seconds}s` : 'off'}</span>{m.last_poll && <> · last check {timeAgo(m.last_poll)}, {m.last_count} email(s)</>}</p>
              {m.last_error && <p className="text-coral">Last error: {m.last_error}</p>}
            </div>
          </Panel>

          <Panel eyebrow="Rules" title="When things happen">
            <ul className="space-y-3 text-sm">
              <li className="flex items-baseline justify-between gap-4 border-b border-white/[0.06] pb-3">
                <span className="text-fog">Lead score that alerts Slack</span>
                <span className="font-display text-2xl text-bone">{info.rules.hot_lead_threshold}+</span>
              </li>
              <li className="flex items-baseline justify-between gap-4">
                <span className="text-fog">Document total that needs approval</span>
                <span className="font-display text-2xl text-bone">{info.rules.document_approval_amount.toLocaleString()}+</span>
              </li>
            </ul>
          </Panel>
        </div>

        <Panel eyebrow="Your account" title="Trigger key" actions={
          <button type="button" onClick={rotate} disabled={rotating || !info.can_connect} className="btn-ghost !py-1.5 text-xs">
            {rotating ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />} New key
          </button>
        }>
          <p className="mb-4 text-sm text-fog">Public triggers (your website form, webhooks from Zapier or n8n) use this key to know the work is yours. Keep it private.</p>
          <div className="flex flex-wrap items-center gap-2">
            <KeyRound className="h-4 w-4 text-blush" aria-hidden />
            <code className="rounded-xl border border-white/[0.07] bg-noir-950/70 px-3 py-2 font-mono text-xs text-bone">{shownKey}</code>
            <button type="button" className="btn-quiet !px-2.5 !py-1 text-xs" onClick={() => setRevealKey((r) => !r)}>{revealKey ? 'Hide' : 'Show'}</button>
          </div>
        </Panel>

        <Panel eyebrow="Trigger" title="Website form">
          <p className="mb-4 text-sm text-fog">Point any HTML form here. Fields like name, email, company, phone and message are recognised automatically.</p>
          <CodeBlock code={`<form method="POST" action="${API_BASE_URL}${info.triggers.form_url}?key=${key}">
  <input name="name" required>
  <input name="email" type="email" required>
  <input name="company">
  <textarea name="message"></textarea>
  <button>Send</button>
</form>`} />
          <p className="mb-2 mt-5 text-sm text-fog">Run a workflow from Zapier, n8n or your own code:</p>
          <CodeBlock code={`curl -X POST "${API_BASE_URL}${info.triggers.webhook_url.replace('{workflow_id}', '1')}?key=${key}" \\
  -H "Content-Type: application/json" -d '{"name":"Ann","email":"ann@corp.io"}'`} />
          <p className="mt-4 text-xs text-fog">These snippets contain your real key. Don&apos;t paste them anywhere public.</p>
        </Panel>
      </motion.div>
    </div>
  );
}
