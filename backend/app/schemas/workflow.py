"""
Pydantic schemas for API request/response validation
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


# Workflow Schemas
class WorkflowBase(BaseModel):
    """Base workflow schema"""
    name: str = Field(..., description="Workflow name")
    description: Optional[str] = Field(None, description="Workflow description")
    workflow_type: str = Field(..., description="Type of workflow")
    config: Optional[Dict[str, Any]] = Field(None, description="Workflow configuration")
    is_active: bool = Field(True, description="Whether workflow is active")
    n8n_workflow_id: Optional[str] = None
    zapier_webhook_url: Optional[str] = None


class WorkflowCreate(WorkflowBase):
    """Schema for creating a workflow"""
    pass


class WorkflowUpdate(BaseModel):
    """Schema for updating a workflow"""
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    n8n_workflow_id: Optional[str] = None
    zapier_webhook_url: Optional[str] = None


class WorkflowResponse(WorkflowBase):
    """Schema for workflow response"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Workflow Execution Schemas
class WorkflowExecutionCreate(BaseModel):
    """Schema for creating a workflow execution"""
    workflow_id: int
    input_data: Dict[str, Any]


class WorkflowExecutionResponse(BaseModel):
    """Schema for workflow execution response"""
    id: int
    workflow_id: int
    status: str
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    agent_logs: Optional[List[Dict[str, Any]]] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    
    class Config:
        from_attributes = True


# Agent Task Schemas
class AgentTaskResponse(BaseModel):
    """Schema for agent task response"""
    id: int
    execution_id: int
    agent_name: str
    agent_role: str
    task_description: str
    status: str
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None
    reasoning: Optional[str] = None
    started_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Webhook Schemas
class WebhookPayload(BaseModel):
    """Generic webhook payload"""
    event: str
    data: Dict[str, Any]
    timestamp: Optional[datetime] = None


# Lead Qualification Schema (Use Case 1)
class LeadInput(BaseModel):
    """Input schema for lead qualification"""
    name: str
    email: str
    company: Optional[str] = None
    phone: Optional[str] = None
    message: Optional[str] = None
    source: Optional[str] = "website"
    additional_data: Optional[Dict[str, Any]] = None


class LeadQualificationResult(BaseModel):
    """Result of lead qualification"""
    lead_score: int = Field(..., ge=0, le=100, description="Lead score 0-100")
    qualification: str = Field(..., description="High/Medium/Low")
    enriched_data: Optional[Dict[str, Any]] = None
    recommended_action: str
    assigned_to: Optional[str] = None
    reasoning: str


# Email Processing Schema (Use Case 2)
class EmailInput(BaseModel):
    """Input schema for email processing"""
    from_email: str
    subject: str
    body: str
    received_at: Optional[datetime] = None
    attachments: Optional[List[str]] = None


class EmailProcessingResult(BaseModel):
    """Result of email processing"""
    category: str = Field(..., description="support/sales/partnership/spam")
    priority: str = Field(..., description="urgent/high/medium/low")
    sentiment: str = Field(..., description="positive/neutral/negative")
    draft_response: Optional[str] = None
    action_required: bool
    assigned_to: Optional[str] = None
    tags: List[str] = []


# Document Processing Schema (Use Case 3)
class DocumentInput(BaseModel):
    """Input schema for document processing"""
    document_type: str = Field(..., description="invoice/contract/receipt")
    file_url: Optional[str] = None
    file_content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class DocumentProcessingResult(BaseModel):
    """Result of document processing"""
    document_type: str
    extracted_data: Dict[str, Any]
    validation_status: str = Field(..., description="valid/invalid/needs_review")
    validation_errors: Optional[List[str]] = None
    approval_required: bool
    next_steps: List[str]

