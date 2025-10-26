"""
Schemas module initialization
"""
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowUpdate,
    WorkflowResponse,
    WorkflowExecutionCreate,
    WorkflowExecutionResponse,
    AgentTaskResponse,
    WebhookPayload,
    LeadInput,
    LeadQualificationResult,
    EmailInput,
    EmailProcessingResult,
    DocumentInput,
    DocumentProcessingResult,
)

__all__ = [
    "WorkflowCreate",
    "WorkflowUpdate",
    "WorkflowResponse",
    "WorkflowExecutionCreate",
    "WorkflowExecutionResponse",
    "AgentTaskResponse",
    "WebhookPayload",
    "LeadInput",
    "LeadQualificationResult",
    "EmailInput",
    "EmailProcessingResult",
    "DocumentInput",
    "DocumentProcessingResult",
]

