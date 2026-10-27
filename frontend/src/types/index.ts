/**
 * TypeScript types mirroring the FlowMancer API.
 */

export type Kind = 'lead' | 'email' | 'document';
export type Mode = 'quick' | 'crew';
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';

export interface Step {
  name: string;
  status: StepStatus;
  started_at: string | null;
  finished_at: string | null;
  output: string | null;
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

export interface KnowledgeSnippet {
  doc_id: number;
  doc_name: string;
  text: string;
  score: number | null;
}

export interface ActionResult {
  action?: string;
  reason?: string;
  target?: string;
  status: 'success' | 'skipped' | 'error';
  detail: string;
}

export interface ScoreBreakdown {
  company_size: number;
  industry_fit: number;
  budget: number;
  urgency: number;
  decision_maker: number;
  intent: number;
}

export interface LeadResult {
  lead_score: number;
  qualification: 'High' | 'Medium' | 'Low';
  score_breakdown: ScoreBreakdown;
  priority: string;
  recommended_action: string;
  assigned_to: string;
  talking_points: string[];
  reasoning: string;
  company_summary: string;
}

export interface EmailResult {
  category: string;
  priority: string;
  sentiment: string;
  summary: string;
  draft_reply: string;
  action_required: boolean;
  assigned_team: string;
  tags: string[];
}

export interface DocumentResult {
  document_type: string;
  summary: string;
  counterparty: string | null;
  document_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  line_items: { description: string; amount: number }[];
  tax_amount: number | null;
  total_amount: number | null;
  currency: string | null;
  fields: { name: string; value: string }[];
  validation_status: 'valid' | 'invalid' | 'needs_review';
  issues: string[];
  ai_notes: string[];
  approval_required: boolean;
  approver: string | null;
  next_steps: string[];
}

export interface Run {
  id: number;
  kind: Kind;
  mode: Mode;
  status: RunStatus;
  source: string;
  input_data: Record<string, any> | null;
  output: (LeadResult | EmailResult | DocumentResult | Record<string, any>) | null;
  raw_text: string | null;
  steps: Step[] | null;
  research: Source[] | null;
  knowledge: KnowledgeSnippet[] | null;
  actions: ActionResult[] | null;
  ai_model: string | null;
  error: string | null;
  workflow_execution_id: number | null;
  created_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
}

export interface RunList {
  total: number;
  items: Run[];
}

export type ApprovalAction = 'email_reply' | 'crm_contact' | 'document_approval' | 'slack_message';

export interface Approval {
  id: number;
  run_id: number | null;
  workflow_execution_id: number | null;
  action: ApprovalAction;
  title: string;
  payload: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  result: { status: string; steps: ActionResult[] } | null;
  note: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface KnowledgeDocument {
  id: number;
  name: string;
  characters: number;
  chunks: number;
  created_at: string;
}

export interface GraphNode {
  id: string;
  type: 'trigger' | 'ai' | 'condition' | 'action';
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Workflow {
  id: number;
  name: string;
  description?: string | null;
  workflow_type: 'lead_qualification' | 'email_processing' | 'document_automation' | 'custom';
  config?: WorkflowGraph | null;
  is_active: boolean;
  n8n_workflow_id?: string | null;
  zapier_webhook_url?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ExecutionLog {
  node_id: string | null;
  type: string;
  label: string;
  status: string;
  detail: string;
  at: string;
  run_id?: number;
}

export interface WorkflowExecution {
  id: number;
  workflow_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input_data?: Record<string, any> | null;
  output_data?: Record<string, any> | null;
  error_message?: string | null;
  agent_logs?: ExecutionLog[] | null;
  started_at?: string | null;
  completed_at?: string | null;
  duration_seconds?: number | null;
}

export interface Stats {
  totals: {
    runs: number;
    completed: number;
    failed: number;
    in_progress: number;
    success_rate: number | null;
    avg_duration_seconds: number | null;
    workflows: number;
    active_workflows: number;
    workflow_executions: number;
    pending_approvals: number;
    knowledge_documents: number;
  };
  by_kind: Record<string, number>;
  by_mode: Record<string, number>;
  runs_per_day: { date: string; lead: number; email: number; document: number }[];
  leads: { count: number; avg_score: number | null; by_qualification: Record<string, number> };
  emails: { count: number; by_category: Record<string, number>; by_priority: Record<string, number>; by_sentiment: Record<string, number> };
  documents: { count: number; by_status: Record<string, number>; approval_required: number };
}

export interface Integrations {
  ai: { provider: string; model: string; reachable: boolean | null; detail: string };
  research: { enabled: boolean; engine: string };
  slack: { configured: boolean };
  hubspot: { configured: boolean };
  webhook: { configured: boolean };
  mailbox: {
    configured: boolean;
    host: string | null;
    user: string | null;
    folder: string;
    auto_poll_seconds: number;
    last_poll: string | null;
    last_count: number;
    last_error: string | null;
    polling: boolean;
  };
  triggers: { secret_required: boolean; form_url: string; webhook_url: string };
  rules: { hot_lead_threshold: number; document_approval_amount: number };
}
