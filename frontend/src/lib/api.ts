/**
 * API client for the FlowMancer backend.
 * Every request carries the signed-in user's token; a 401 signs the user out.
 */
import axios, { AxiosError } from 'axios';
import type {
  Approval, AuthConfig, AuthSession, ChatReply, ChatTurn, ConnectionStatus, Integrations, Kind, KnowledgeDocument, Mode,
  Provider, Run, RunList, Stats, UsageReport, User, Workflow, WorkflowExecution, WorkflowGraph,
} from '@/types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/* ---------- token storage ---------- */
const TOKEN_KEY = 'flowmancer.token';
export const UNAUTHORIZED_EVENT = 'flowmancer:unauthorized';

export function getToken(): string | null {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}
export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

api.interceptors.response.use(undefined, (error) => {
  const url: string = error?.config?.url || '';
  const signingIn = url.startsWith('/api/auth/login') || url.startsWith('/api/auth/google') || url.startsWith('/api/auth/demo');
  if (error instanceof AxiosError && error.response?.status === 401 && !signingIn) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  return Promise.reject(error);
});

/** Turn any API error into a readable message. */
export function errorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const detail = (err.response?.data as any)?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => {
        if (typeof d === 'string') return d;
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : d.field;
        const msg = d.msg || d.error || JSON.stringify(d);
        return field && field !== 'body' ? `${field}: ${msg}` : msg;
      }).join('; ');
    }
    if (!err.response) return `Cannot reach the backend at ${API_BASE_URL}. Is it running?`;
    return `${err.response.status}: ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

export const authApi = {
  config: () => api.get<AuthConfig>('/api/auth/config').then((r) => r.data),
  login: (email: string, password: string) =>
    api.post<AuthSession>('/api/auth/login', { email, password }).then((r) => r.data),
  google: (accessToken: string) => api.post<AuthSession>('/api/auth/google', { access_token: accessToken }).then((r) => r.data),
  register: (name: string, email: string, password: string) =>
    api.post<AuthSession>('/api/auth/register', { name, email, password }).then((r) => r.data),
  demo: () => api.post<AuthSession>('/api/auth/demo').then((r) => r.data),
  me: () => api.get<User>('/api/auth/me').then((r) => r.data),
  updateMe: (name: string) => api.patch<User>('/api/auth/me', { name }).then((r) => r.data),
  changePassword: (current_password: string | null, new_password: string) =>
    api.post<User>('/api/auth/password', { current_password, new_password }).then((r) => r.data),
  deleteAccount: (confirm_email: string, password: string | null) =>
    api.delete('/api/auth/me', { data: { confirm_email, password } }),
  rotateTriggerKey: () => api.post<User>('/api/auth/trigger-key/rotate').then((r) => r.data),
};

export const assistantApi = {
  chat: (messages: Pick<ChatTurn, 'role' | 'content'>[]) =>
    api.post<ChatReply>('/api/assistant/chat', { messages }).then((r) => r.data),
};

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
  list: (params: RunFilters & { limit?: number; offset?: number }) =>
    api.get<RunList>('/api/runs/', { params }).then((r) => r.data),
  /** CSV of the filtered history (fetched with the auth header, then saved by the browser). */
  exportCsv: async (params: RunFilters) => {
    const r = await api.get<Blob>('/api/runs/export', { params, responseType: 'blob' });
    const name = /filename="([^"]+)"/.exec(r.headers['content-disposition'] || '')?.[1] || 'flowmancer-runs.csv';
    const url = URL.createObjectURL(r.data);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  },
  feedback: (id: number, field: string, correct: string, note: string) =>
    api.post<Run>(`/api/runs/${id}/feedback`, { field, correct: correct || null, note: note || null }).then((r) => r.data),
  rerun: (id: number, mode: Mode = 'crew') =>
    api.post<Run>(`/api/runs/${id}/rerun`, null, { params: { mode } }).then((r) => r.data),
  get: (id: number) => api.get<Run>(`/api/runs/${id}`).then((r) => r.data),
  approvals: (id: number) => api.get<Approval[]>(`/api/runs/${id}/approvals`).then((r) => r.data),
  eventsUrl: (id: number) => `${API_BASE_URL}/api/runs/${id}/events`,
};

export const approvalsApi = {
  list: (status?: string) => api.get<Approval[]>('/api/approvals/', { params: { status } }).then((r) => r.data),
  approve: (id: number, payload?: Record<string, any>, note?: string, delivery: 'draft' | 'send' = 'draft') =>
    api.post<Approval>(`/api/approvals/${id}/approve`, { payload, note, delivery }).then((r) => r.data),
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
  usage: (days: number) => api.get<UsageReport>('/api/usage', { params: { days } }).then((r) => r.data),
  loadSample: () => api.post<{ runs: number }>('/api/sample-data').then((r) => r.data),
};

export const connectionsApi = {
  connect: (provider: Provider, fields: Record<string, string>) =>
    api.put<ConnectionStatus>(`/api/connections/${provider}`, fields).then((r) => r.data),
  disconnect: (provider: Provider) => api.delete<ConnectionStatus>(`/api/connections/${provider}`).then((r) => r.data),
};

export interface RunFilters { kind?: string; status?: string; mode?: string; source?: string; q?: string }

export default api;
