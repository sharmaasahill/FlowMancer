'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Check, Copy, Globe, Inbox, MessageSquare, RefreshCw, Webhook } from 'lucide-react';
import Orb from '@/components/Orb';
import { useToast } from '@/components/Toast';
import { ErrorBanner, Loading, PageHeader, Panel, rise, Spinner, stagger } from '@/components/ui';
import { API_BASE_URL, errorMessage, systemApi } from '@/lib/api';
import { useSystem } from '@/lib/system';
import { cn, timeAgo } from '@/lib/utils';

function Connection({ icon: Icon, name, on, detail, setting }: {
  icon: typeof Globe; name: string; on: boolean; detail: string; setting?: string;
}) {
  return (
    <motion.div variants={rise} className={cn('glass relative overflow-hidden !rounded-[22px] p-5', on && 'border-crimson-400/25')}>
      {on && <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-crimson/30 blur-3xl" aria-hidden />}
      <div className="relative flex items-start justify-between">
        <span className={cn('grid h-11 w-11 place-items-center rounded-2xl border', on ? 'border-crimson-400/40 bg-crimson/25 text-blush' : 'border-white/[0.07] bg-white/[0.03] text-fog')}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className={cn('flex items-center gap-1.5 text-xs font-medium', on ? 'text-jade' : 'text-fog')}>
          <span className={cn('h-1.5 w-1.5 rounded-full bg-current', on && 'animate-blink')} aria-hidden />{on ? 'Connected' : 'Not set up'}
        </span>
      </div>
      <p className="relative mt-4 font-semibold text-bone">{name}</p>
      <p className="relative mt-1 text-sm text-fog">{detail}</p>
      {!on && setting && <p className="relative mt-3 font-mono text-[11px] text-ash">backend/.env → {setting}</p>}
    </motion.div>
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
  const toast = useToast();

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
  const secret = info.triggers.secret_required ? '?secret=YOUR_TRIGGER_SECRET' : '';

  return (
    <div className="space-y-8 pt-4">
      <PageHeader eyebrow="Integrations" title="Wired" accent="in."
        subtitle="Set these in backend/.env and restart the backend. Anything not set up is skipped, never broken." />
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

        <motion.div variants={stagger(0.05)} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Connection icon={Globe} name="Lead research" on={info.research.enabled}
            detail={info.research.enabled ? info.research.engine : 'Turned off'} setting="RESEARCH_ENABLED=true" />
          <Connection icon={MessageSquare} name="Slack" on={info.slack.configured}
            detail="Hot leads, urgent emails and approved documents are posted." setting="SLACK_WEBHOOK_URL" />
          <Connection icon={Building2} name="HubSpot CRM" on={info.hubspot.configured}
            detail="Approved leads become contacts." setting="HUBSPOT_ACCESS_TOKEN" />
          <Connection icon={Webhook} name="Webhook (Zapier · n8n · Make)" on={info.webhook.configured}
            detail="Approved documents are sent here. Workflows can call their own URLs too." setting="WEBHOOK_URL" />
          <Connection icon={Inbox} name="Mailbox (IMAP)" on={m.configured}
            detail={m.configured ? `${m.user} on ${m.host}` : 'Read unread email and save reply drafts.'} setting="IMAP_HOST, IMAP_USER, IMAP_PASSWORD" />
        </motion.div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel eyebrow="Trigger" title="Inbox" actions={
            <button type="button" onClick={poll} disabled={!m.configured || polling} className="btn-ghost !py-1.5 text-xs">
              {polling ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />} Check now
            </button>
          }>
            <div className="space-y-2 text-sm text-fog">
              <p>Unread mail in <span className="font-mono text-bone">{m.folder}</span> is processed and marked read. Approved replies go to your Drafts folder; nothing is sent.</p>
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

        <Panel eyebrow="Trigger" title="Website form">
          <p className="mb-4 text-sm text-fog">Point any HTML form here. Fields like name, email, company, phone and message are recognised automatically.</p>
          <CodeBlock code={`<form method="POST" action="${API_BASE_URL}${info.triggers.form_url}${secret}">
  <input name="name" required>
  <input name="email" type="email" required>
  <input name="company">
  <textarea name="message"></textarea>
  <button>Send</button>
</form>`} />
          <p className="mb-2 mt-5 text-sm text-fog">Run a workflow from Zapier, n8n or your own code:</p>
          <CodeBlock code={`curl -X POST ${API_BASE_URL}${info.triggers.webhook_url.replace('{workflow_id}', '1')}${secret} \\
  -H "Content-Type: application/json" -d '{"name":"Ann","email":"ann@corp.io"}'`} />
          {!info.triggers.secret_required && (
            <p className="mt-4 text-xs text-amber">These URLs are open to anyone who can reach the backend. Set TRIGGER_SECRET before putting it online.</p>
          )}
        </Panel>
      </motion.div>
    </div>
  );
}
