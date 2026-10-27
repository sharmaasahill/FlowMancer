'use client';

import type { Node } from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import { Field, buttonClass, inputClass } from '@/components/ui';
import { RESULT_FIELDS } from '@/lib/workflowTemplates';

interface Props {
  node: Node;
  aiTasks: string[];
  onChange: (data: Record<string, any>) => void;
  onDelete: () => void;
}

/** Settings form for the selected node. */
export default function NodeSettings({ node, aiTasks, onChange, onDelete }: Props) {
  const d = node.data as Record<string, any>;
  const set = (key: string, value: any) => onChange({ ...d, [key]: value });
  const id = (k: string) => `node-${node.id}-${k}`;
  const fieldOptions = (aiTasks.length ? aiTasks : ['lead', 'email', 'document']).flatMap((t) => RESULT_FIELDS[t] || []);

  return (
    <div className="space-y-4">
      <Field label="Label" htmlFor={id('label')}>
        <input id={id('label')} className={inputClass} value={d.label || ''} onChange={(e) => set('label', e.target.value)} />
      </Field>

      {node.type === 'trigger' && (
        <Field label="Starts when" htmlFor={id('trigger')} hint="Every workflow can also be run by hand or through the API">
          <select id={id('trigger')} className={inputClass} value={d.trigger} onChange={(e) => set('trigger', e.target.value)}>
            <option value="manual">Run manually / API</option>
            <option value="form">Website form submission</option>
            <option value="inbox">New email in the inbox</option>
            <option value="webhook">Webhook call</option>
          </select>
        </Field>
      )}

      {node.type === 'ai' && (
        <>
          <Field label="Task" htmlFor={id('task')}>
            <select id={id('task')} className={inputClass} value={d.task} onChange={(e) => set('task', e.target.value)}>
              <option value="lead">Qualify lead</option>
              <option value="email">Process email</option>
              <option value="document">Process document</option>
            </select>
          </Field>
          <Field label="Mode" htmlFor={id('mode')}>
            <select id={id('mode')} className={inputClass} value={d.mode || 'quick'} onChange={(e) => set('mode', e.target.value)}>
              <option value="quick">Quick (one AI call)</option>
              <option value="crew">Crew (4 agents, slower)</option>
            </select>
          </Field>
        </>
      )}

      {node.type === 'condition' && (
        <>
          <Field label="Field" htmlFor={id('field')} hint="A result field from the AI step, or input.<name> for the raw input">
            <input id={id('field')} list={id('fields')} className={inputClass} value={d.field || ''} onChange={(e) => set('field', e.target.value)} />
            <datalist id={id('fields')}>{fieldOptions.map((f) => <option key={f} value={f} />)}</datalist>
          </Field>
          <Field label="Operator" htmlFor={id('op')}>
            <select id={id('op')} className={inputClass} value={d.operator} onChange={(e) => set('operator', e.target.value)}>
              <option value="eq">equals</option>
              <option value="neq">does not equal</option>
              <option value="gt">greater than</option>
              <option value="gte">at least</option>
              <option value="lt">less than</option>
              <option value="lte">at most</option>
              <option value="contains">contains</option>
              <option value="is_true">is true</option>
              <option value="is_false">is false</option>
            </select>
          </Field>
          {!['is_true', 'is_false'].includes(d.operator) && (
            <Field label="Value" htmlFor={id('value')}>
              <input id={id('value')} className={inputClass} value={d.value ?? ''} onChange={(e) => set('value', e.target.value)} />
            </Field>
          )}
          <p className="text-xs text-gray-500">Connect the green handle for &quot;yes&quot; and the red handle for &quot;no&quot;.</p>
        </>
      )}

      {node.type === 'action' && (
        <>
          <Field label="Action" htmlFor={id('action')}>
            <select id={id('action')} className={inputClass} value={d.action} onChange={(e) => set('action', e.target.value)}>
              <option value="slack">Post Slack message</option>
              <option value="webhook">Call a webhook (Zapier, n8n, Make)</option>
              <option value="crm">Create HubSpot contact (no approval)</option>
              <option value="email_draft">Save reply draft (no approval)</option>
              <option value="approval">Request human approval</option>
            </select>
          </Field>
          {(d.action === 'slack' || (d.action === 'approval' && d.approval_action === 'slack_message')) && (
            <Field label="Message" htmlFor={id('text')} hint="Use {input.name}, {result.lead_score}, {result.summary}, ...">
              <textarea id={id('text')} rows={3} className={inputClass} value={d.text || ''} onChange={(e) => set('text', e.target.value)} />
            </Field>
          )}
          {d.action === 'webhook' && (
            <Field label="Webhook URL" htmlFor={id('url')}>
              <input id={id('url')} type="url" className={inputClass} value={d.url || ''} onChange={(e) => set('url', e.target.value)} placeholder="https://hooks.zapier.com/..." />
            </Field>
          )}
          {d.action === 'approval' && (
            <Field label="What to approve" htmlFor={id('approval')}>
              <select id={id('approval')} className={inputClass} value={d.approval_action || ''} onChange={(e) => set('approval_action', e.target.value)}>
                <option value="" disabled>Choose...</option>
                <option value="email_reply">Reply draft (needs an email step)</option>
                <option value="crm_contact">CRM contact (needs a lead step)</option>
                <option value="document_approval">Document (needs a document step)</option>
                <option value="slack_message">Slack message</option>
              </select>
            </Field>
          )}
        </>
      )}

      {node.type !== 'trigger' && (
        <button type="button" onClick={onDelete} className={buttonClass.danger}>
          <Trash2 className="h-4 w-4" aria-hidden /> Delete step
        </button>
      )}
    </div>
  );
}
