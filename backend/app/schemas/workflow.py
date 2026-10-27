"""
Pydantic schemas for API request/response validation
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from typing import Annotated
from pydantic import AfterValidator, BaseModel, ConfigDict, Field, EmailStr


def _as_utc(value: datetime) -> datetime:
    # The database stores UTC without an offset; mark it so clients don't read it as local time
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


UTCDateTime = Annotated[datetime, AfterValidator(_as_utc)]


# ---------- Workflows ----------
class WorkflowBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = Field(None, description="Visual graph: {nodes: [...], edges: [...]}")
    is_active: bool = True


class WorkflowCreate(WorkflowBase):
    pass


class WorkflowUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class WorkflowResponse(WorkflowBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: UTCDateTime
    updated_at: Optional[UTCDateTime] = None


# ---------- Executions ----------
class WorkflowRunRequest(BaseModel):
    input_data: Dict[str, Any]


class WorkflowExecutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workflow_id: int
    status: str
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    agent_logs: Optional[List[Dict[str, Any]]] = None
    started_at: Optional[UTCDateTime] = None
    completed_at: Optional[UTCDateTime] = None
    duration_seconds: Optional[int] = None


# ---------- Use-case inputs ----------
class LeadInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    company: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    message: Optional[str] = Field(None, max_length=5000)
    source: Optional[str] = "website"
    additional_data: Optional[Dict[str, Any]] = None


class EmailInput(BaseModel):
    from_email: str = Field(..., min_length=3, max_length=320)
    subject: str = Field(..., max_length=500)
    body: str = Field(..., max_length=50000)
    received_at: Optional[datetime] = None
    message_id: Optional[str] = None
    attachments: Optional[List[str]] = None


class DocumentInput(BaseModel):
    document_type: str = Field("auto", description="invoice/contract/receipt/auto")
    file_name: Optional[str] = None
    file_content: str = Field(..., min_length=1, max_length=200000)
    metadata: Optional[Dict[str, Any]] = None


# ---------- Runs ----------
class RunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    mode: str
    status: str
    source: str
    input_data: Optional[Dict[str, Any]] = None
    output: Optional[Dict[str, Any]] = None
    raw_text: Optional[str] = None
    steps: Optional[List[Dict[str, Any]]] = None
    research: Optional[List[Dict[str, Any]]] = None
    knowledge: Optional[List[Dict[str, Any]]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    ai_model: Optional[str] = None
    error: Optional[str] = None
    workflow_execution_id: Optional[int] = None
    created_at: Optional[UTCDateTime] = None
    completed_at: Optional[UTCDateTime] = None
    duration_seconds: Optional[float] = None


class RunList(BaseModel):
    total: int
    items: List[RunResponse]


# ---------- Approvals ----------
class ApprovalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    run_id: Optional[int] = None
    workflow_execution_id: Optional[int] = None
    action: str
    title: str
    payload: Dict[str, Any]
    status: str
    result: Optional[Dict[str, Any]] = None
    note: Optional[str] = None
    created_at: Optional[UTCDateTime] = None
    decided_at: Optional[UTCDateTime] = None


class ApprovalDecision(BaseModel):
    payload: Optional[Dict[str, Any]] = Field(None, description="Edited payload; omitted fields keep their value")
    note: Optional[str] = Field(None, max_length=2000)


# ---------- Knowledge ----------
class KnowledgeTextInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    text: str = Field(..., min_length=1, max_length=500000)


class KnowledgeDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    characters: int
    chunks: int
    created_at: Optional[UTCDateTime] = None
