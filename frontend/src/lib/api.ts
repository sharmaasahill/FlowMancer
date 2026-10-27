/**
 * API client for the FlowMancer backend.
 */
import axios, { AxiosError } from 'axios';
import type {
  Approval, Integrations, Kind, KnowledgeDocument, Mode, Run, RunList, Stats,
  Workflow, WorkflowExecution, WorkflowGraph,
} from '@/types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: API_BASE_URL });

/** Turn any API error into a readable message. */
export function errorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const detail = (err.response?.data as any)?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => (typeof d === 'string' ? d : d.msg || d.error || JSON.stringify(d))).join('; ');
    }
    if (!err.response) return `Cannot reach the backend at ${API_BASE_URL}. Is it running?`;
    return `${err.response.status}: ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

export const runsApi = {
  startJob: (kind: Kind, payload: Record<string, any>, mode: Mode) =>
    api.post<Run>(`/api/use-cases/jobs/${kind}`, payload, { params: { mode } }).then((r) => r.data),
  uploadDocument: (file: File, documentType: string, mode: Mode) => {
    const form = new FormData();
    form.append('file', file);
    form.append('document_type', documentType);
    form.append('mode', mode);
    return api.post<Run>('/api/use-cases/process-document/upload', form).then((r) => r.data);
  },
  list: (params: { kind?: string; status?: string; mode?: string; source?: string; limit?: number; offset?: number }) =>
    api.get<RunList>('/api/runs/', { params }).then((r) => r.data),
  get: (id: number) => api.get<Run>(`/api/runs/${id}`).then((r) => r.data),
  approvals: (id: number) => api.get<Approval[]>(`/api/runs/${id}/approvals`).then((r) => r.data),
  eventsUrl: (id: number) => `${API_BASE_URL}/api/runs/${id}/events`,
};

export const approvalsApi = {
  list: (status?: string) => api.get<Approval[]>('/api/approvals/', { params: { status } }).then((r) => r.data),
  approve: (id: number, payload?: Record<string, any>, note?: string) =>
    api.post<Approval>(`/api/approvals/${id}/approve`, { payload, note }).then((r) => r.data),
  reject: (id: number, note?: string) => api.post<Approval>(`/api/approvals/${id}/reject`, { note }).then((r) => r.data),
};

export const knowledgeApi = {
  list: () => api.get<KnowledgeDocument[]>('/api/knowledge/').then((r) => r.data),
  addText: (name: string, text: string) =>
    api.post<KnowledgeDocument>('/api/knowledge/text', { name, text }).then((r) => r.data),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<KnowledgeDocument>('/api/knowledge/upload', form).then((r) => r.data);
  },
  remove: (id: number) => api.delete(`/api/knowledge/${id}`),
  search: (q: string) =>
    api.get<{ results: { doc_name: string; text: string; score: number | null }[] }>('/api/knowledge/search', { params: { q } })
      .then((r) => r.data.results),
};

export const workflowsApi = {
  list: () => api.get<Workflow[]>('/api/workflows/').then((r) => r.data),
  get: (id: number) => api.get<Workflow>(`/api/workflows/${id}`).then((r) => r.data),
  create: (data: Partial<Workflow>) => api.post<Workflow>('/api/workflows/', data).then((r) => r.data),
  update: (id: number, data: Partial<Workflow> & { config?: WorkflowGraph | null }) =>
    api.put<Workflow>(`/api/workflows/${id}`, data).then((r) => r.data),
  remove: (id: number) => api.delete(`/api/workflows/${id}`),
  run: (id: number, input_data: Record<string, any>) =>
    api.post<WorkflowExecution>(`/api/workflows/${id}/run`, { input_data }).then((r) => r.data),
  executions: (id: number) => api.get<WorkflowExecution[]>(`/api/workflows/${id}/executions`).then((r) => r.data),
  execution: (id: number) => api.get<WorkflowExecution>(`/api/executions/${id}`).then((r) => r.data),
};

export const systemApi = {
  stats: () => api.get<Stats>('/api/stats').then((r) => r.data),
  integrations: () => api.get<Integrations>('/api/integrations').then((r) => r.data),
  pollInbox: () => api.post<{ fetched: number; dispatched: any[] }>('/api/triggers/inbox/poll').then((r) => r.data),
};

export default api;
