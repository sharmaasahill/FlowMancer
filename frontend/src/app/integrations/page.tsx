'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, MinusCircle, RefreshCw, XCircle } from 'lucide-react';
import { API_BASE_URL, errorMessage, systemApi } from '@/lib/api';
import type { Integrations } from '@/types';
import { Card, ErrorBanner, PageHeader, Spinner, buttonClass } from '@/components/ui';
import { formatDate } from '@/lib/utils';

function Status({ ok, label, detail }: { ok: boolean | null; label: string; detail: string }) {
  const Icon = ok === true ? CheckCircle2 : ok === false ? XCircle : MinusCircle;
  const color = ok === true ? 'text-green-600' : ok === false ? 'text-red-600' : 'text-gray-400';
  return (
    <li className="flex items-start gap-3 py-3">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} aria-hidden />
      <div>
        <p className="font-medium text-gray-900">{label} <span className="sr-only">{ok ? 'ready' : 'not set up'}</span></p>
        <p className="text-sm text-gray-600">{detail}</p>
      </div>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{children}</code>;
}

export default function IntegrationsPage() {
  const [info, setInfo] = useState<Integrations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollResult, setPollResult] = useState<string | null>(null);

  const load = () => systemApi.integrations().then(setInfo).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const poll = async () => {
    setPolling(true);
    setPollResult(null);
    setError(null);
    try {
      const r = await systemApi.pollInbox();
      setPollResult(`Fetched ${r.fetched} unread email(s). They're processing now; see History.`);
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPolling(false);
    }
  };

  if (!info) return <div className="space-y-6"><PageHeader title="Integrations" /><ErrorBanner message={error} />{!error && <Spinner />}</div>;
  const m = info.mailbox;
  const secret = info.triggers.secret_required ? '?secret=YOUR_TRIGGER_SECRET' : '';

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" subtitle="Configure these in backend/.env, then restart the backend" />
      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Connections">
          <ul className="divide-y divide-gray-100">
            <Status ok={info.ai.reachable} label={`AI model: ${info.ai.model}`} detail={info.ai.detail} />
            <Status ok={info.research.enabled} label="Lead research" detail={info.research.enabled ? info.research.engine : 'Disabled (RESEARCH_ENABLED=false)'} />
            <Status ok={m.configured || null} label="Mailbox (IMAP)" detail={m.configured ? `${m.user} on ${m.host}` : 'Set IMAP_HOST, IMAP_USER, IMAP_PASSWORD'} />
            <Status ok={info.slack.configured || null} label="Slack" detail={info.slack.configured ? 'Hot leads, urgent emails and approved documents are posted' : 'Set SLACK_WEBHOOK_URL'} />
            <Status ok={info.hubspot.configured || null} label="HubSpot CRM" detail={info.hubspot.configured ? 'Approved leads become contacts' : 'Set HUBSPOT_ACCESS_TOKEN'} />
            <Status ok={info.webhook.configured || null} label="Default webhook (Zapier / n8n / Make)" detail={info.webhook.configured ? 'Approved documents are sent here' : 'Set ZAPIER_WEBHOOK_URL, or add webhook steps to workflows'} />
          </ul>
        </Card>

        <div className="space-y-6">
          <Card title="Inbox" actions={
            <button type="button" onClick={poll} disabled={!m.configured || polling} className={buttonClass.secondary}>
              {polling ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" aria-hidden />} Check inbox now
            </button>
          }>
            <div className="space-y-1 text-sm text-gray-700" aria-live="polite">
              <p>Unread emails in <Code>{m.folder}</Code> are processed and marked as read. Reply drafts go to your Drafts folder after you approve them.</p>
              <p>Automatic checking: {m.auto_poll_seconds > 0 ? `every ${m.auto_poll_seconds}s` : 'off (set INBOX_POLL_SECONDS)'}</p>
              {m.last_poll && <p>Last check: {formatDate(m.last_poll)}, {m.last_count} email(s)</p>}
              {m.last_error && <p className="text-red-700">Last error: {m.last_error}</p>}
              {pollResult && <p className="font-medium text-green-700">{pollResult}</p>}
            </div>
          </Card>

          <Card title="Website form">
            <p className="text-sm text-gray-700">Point any HTML form at this URL. Fields like name, email, company, phone and message are recognised automatically.</p>
            <pre className="mt-3 overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100">{`<form method="POST" action="${API_BASE_URL}${info.triggers.form_url}${secret}">
  <input name="name" required>
  <input name="email" type="email" required>
  <input name="company">
  <textarea name="message"></textarea>
  <button>Send</button>
</form>`}</pre>
            <p className="mt-3 text-sm text-gray-700">
              Workflow webhook for Zapier, n8n or your own code: <Code>POST {API_BASE_URL}{info.triggers.webhook_url}{secret}</Code>
            </p>
            {!info.triggers.secret_required && (
              <p className="mt-2 text-xs text-orange-700">These URLs are open to anyone who can reach the backend. Set TRIGGER_SECRET before exposing it online.</p>
            )}
          </Card>

          <Card title="Rules">
            <p className="text-sm text-gray-700">
              Leads scoring <strong>{info.rules.hot_lead_threshold}+</strong> trigger a Slack alert. Documents of <strong>{info.rules.document_approval_amount.toLocaleString()}+</strong> always need approval.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
