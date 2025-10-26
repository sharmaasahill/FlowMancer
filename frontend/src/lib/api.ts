/**
 * API Client for FlowMancer Backend
 */
import axios from 'axios';
import type { Workflow, WorkflowExecution, LeadInput, EmailInput, DocumentInput } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Workflows API
export const workflowsApi = {
  list: () => api.get<Workflow[]>('/api/workflows/'),
  
  get: (id: number) => api.get<Workflow>(`/api/workflows/${id}`),
  
  create: (data: Partial<Workflow>) => api.post<Workflow>('/api/workflows/', data),
  
  update: (id: number, data: Partial<Workflow>) => 
    api.put<Workflow>(`/api/workflows/${id}`, data),
  
  delete: (id: number) => api.delete(`/api/workflows/${id}`),
  
  getExecutions: (id: number) => 
    api.get<WorkflowExecution[]>(`/api/workflows/${id}/executions`),
};

// Executions API
export const executionsApi = {
  create: (workflowId: number, inputData: any) => 
    api.post<WorkflowExecution>('/api/executions/', {
      workflow_id: workflowId,
      input_data: inputData,
    }),
  
  get: (id: number) => api.get<WorkflowExecution>(`/api/executions/${id}`),
};

// Use Cases API
export const useCasesApi = {
  qualifyLead: (data: LeadInput) => 
    api.post('/api/use-cases/qualify-lead', data),
  
  processEmail: (data: EmailInput) => 
    api.post('/api/use-cases/process-email', data),
  
  processDocument: (data: DocumentInput) => 
    api.post('/api/use-cases/process-document', data),
  
  processBatchLeads: (leads: LeadInput[]) => 
    api.post('/api/use-cases/demo/lead-batch', leads),
};

// Health Check
export const healthCheck = () => api.get('/health');

export default api;

