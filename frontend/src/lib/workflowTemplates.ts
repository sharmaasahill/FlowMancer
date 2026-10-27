import type { WorkflowGraph } from '@/types';

const n = (id: string, type: string, x: number, y: number, data: Record<string, any>) =>
  ({ id, type, position: { x, y }, data }) as WorkflowGraph['nodes'][number];
const e = (source: string, target: string, sourceHandle?: string) =>
  ({ id: `${source}-${sourceHandle || 'out'}-${target}`, source, target, sourceHandle: sourceHandle || null });

export interface Template {
  id: string;
  name: string;
  description: string;
  graph: WorkflowGraph;
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start with just a trigger',
    graph: { nodes: [n('trigger', 'trigger', 250, 0, { trigger: 'manual', label: 'Start' })], edges: [] },
  },
  {
    id: 'hot-lead',
    name: 'Hot lead alert',
    description: 'Website form lead: research and score it. Hot leads go to Slack and a CRM approval; the rest to a webhook.',
    graph: {
      nodes: [
        n('trigger', 'trigger', 250, 0, { trigger: 'form', label: 'Website form' }),
        n('score', 'ai', 250, 110, { task: 'lead', mode: 'quick', label: 'Qualify lead' }),
        n('hot', 'condition', 250, 230, { field: 'lead_score', operator: 'gte', value: '80', label: 'Score 80+?' }),
        n('slack', 'action', 60, 370, { action: 'slack', label: 'Alert sales', text: 'Hot lead: {input.name} ({input.company}) scored {result.lead_score}. {result.recommended_action}' }),
        n('crm', 'action', 60, 480, { action: 'approval', approval_action: 'crm_contact', label: 'Approve CRM contact' }),
        n('nurture', 'action', 440, 370, { action: 'webhook', url: 'https://hooks.zapier.com/hooks/catch/your-id/', label: 'Send to nurture list' }),
      ],
      edges: [e('trigger', 'score'), e('score', 'hot'), e('hot', 'slack', 'true'), e('slack', 'crm'), e('hot', 'nurture', 'false')],
    },
  },
  {
    id: 'support-inbox',
    name: 'Support inbox triage',
    description: 'Every unread email: classify it, alert Slack if urgent, and queue a reply draft for approval.',
    graph: {
      nodes: [
        n('trigger', 'trigger', 250, 0, { trigger: 'inbox', label: 'New email' }),
        n('triage', 'ai', 250, 110, { task: 'email', mode: 'quick', label: 'Triage email' }),
        n('spam', 'condition', 250, 230, { field: 'category', operator: 'neq', value: 'spam', label: 'Not spam?' }),
        n('urgent', 'condition', 250, 360, { field: 'priority', operator: 'eq', value: 'urgent', label: 'Urgent?' }),
        n('alert', 'action', 60, 490, { action: 'slack', label: 'Alert support', text: 'Urgent email from {input.from_email}: {input.subject}. {result.summary}' }),
        n('reply', 'action', 440, 490, { action: 'approval', approval_action: 'email_reply', label: 'Approve reply' }),
        n('reply2', 'action', 60, 600, { action: 'approval', approval_action: 'email_reply', label: 'Approve reply' }),
      ],
      edges: [e('trigger', 'triage'), e('triage', 'spam'), e('spam', 'urgent', 'true'), e('urgent', 'alert', 'true'),
        e('alert', 'reply2'), e('urgent', 'reply', 'false')],
    },
  },
  {
    id: 'invoice',
    name: 'Invoice approval',
    description: 'Process a document from a webhook. Anything needing approval goes to Finance; the rest is sent on automatically.',
    graph: {
      nodes: [
        n('trigger', 'trigger', 250, 0, { trigger: 'webhook', label: 'Document received' }),
        n('extract', 'ai', 250, 110, { task: 'document', mode: 'quick', label: 'Extract & validate' }),
        n('needs', 'condition', 250, 230, { field: 'approval_required', operator: 'is_true', value: '', label: 'Needs approval?' }),
        n('approve', 'action', 60, 370, { action: 'approval', approval_action: 'document_approval', label: 'Finance approval' }),
        n('auto', 'action', 440, 370, { action: 'webhook', url: 'https://hooks.zapier.com/hooks/catch/your-id/', label: 'Send to accounting' }),
      ],
      edges: [e('trigger', 'extract'), e('extract', 'needs'), e('needs', 'approve', 'true'), e('needs', 'auto', 'false')],
    },
  },
];

export const SAMPLE_INPUTS: Record<string, Record<string, any>> = {
  lead: { name: 'John Doe', email: 'john@techcorp.com', company: 'Tech Corp', message: 'Need an enterprise plan for 500 users, budget approved' },
  email: { from_email: 'customer@example.com', subject: 'Login broken', body: 'I cannot log in since yesterday. This is urgent!' },
  document: { document_type: 'invoice', file_content: 'Invoice #123 from Acme Ltd. Total: 1,200 USD. Due: 2026-11-01' },
};

export const RESULT_FIELDS: Record<string, string[]> = {
  lead: ['lead_score', 'qualification', 'priority', 'assigned_to'],
  email: ['category', 'priority', 'sentiment', 'action_required', 'assigned_team', 'tags'],
  document: ['document_type', 'total_amount', 'validation_status', 'approval_required', 'counterparty', 'approver'],
};
