/**
 * TypeScript type definitions for FlowMancer
 */

export interface Workflow {
  id: number;
  name: string;
  description?: string;
  workflow_type: string;
  config?: Record<string, any>;
  is_active: boolean;
  n8n_workflow_id?: string;
  zapier_webhook_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface WorkflowExecution {
  id: number;
  workflow_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input_data?: Record<string, any>;
  output_data?: Record<string, any>;
  error_message?: string;
  agent_logs?: any[];
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
}

export interface LeadInput {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message?: string;
  source?: string;
  additional_data?: Record<string, any>;
}

export interface EmailInput {
  from_email: string;
  subject: string;
  body: string;
  received_at?: string;
  attachments?: string[];
}

export interface DocumentInput {
  document_type: string;
  file_url?: string;
  file_content?: string;
  metadata?: Record<string, any>;
}

export interface ApiResponse<T = any> {
  status: string;
  data?: T;
  result?: any;
  message?: string;
  error?: string;
}

export interface DashboardStats {
  totalWorkflows: number;
  activeWorkflows: number;
  totalExecutions: number;
  successRate: number;
  avgExecutionTime: number;
  recentExecutions: WorkflowExecution[];
}

