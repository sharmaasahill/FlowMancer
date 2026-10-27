"""
Database models
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, Float
from sqlalchemy.sql import func
from app.core.database import Base


class Workflow(Base):
    """An automation workflow. `config` holds the visual graph (nodes + edges) for custom workflows."""
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    # lead_qualification | email_processing | document_automation | custom
    workflow_type = Column(String(50), nullable=False)
    config = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)

    # Legacy integration settings (used when the workflow has no graph)
    n8n_workflow_id = Column(String(255), nullable=True)
    zapier_webhook_url = Column(String(500), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class WorkflowExecution(Base):
    """One run of a workflow. `agent_logs` holds the per-node log."""
    __tablename__ = "workflow_executions"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, nullable=False, index=True)

    status = Column(String(50), default="pending")  # pending, running, completed, failed
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    agent_logs = Column(JSON, nullable=True)

    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)


class Run(Base):
    """One AI processing of a single item (lead, email or document)."""
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String(20), nullable=False, index=True)      # lead | email | document
    mode = Column(String(10), nullable=False, default="quick")  # quick | crew
    status = Column(String(20), nullable=False, default="queued", index=True)  # queued, running, completed, failed
    source = Column(String(30), nullable=False, default="api")  # api, ui, upload, inbox, form, workflow

    input_data = Column(JSON, nullable=True)
    output = Column(JSON, nullable=True)      # structured result
    raw_text = Column(Text, nullable=True)    # crew narrative (crew mode)
    steps = Column(JSON, nullable=True)       # [{name, status, started_at, finished_at, output}]
    research = Column(JSON, nullable=True)    # web sources used
    knowledge = Column(JSON, nullable=True)   # knowledge-base snippets used
    actions = Column(JSON, nullable=True)     # automatic actions taken
    ai_model = Column(String(100), nullable=True)
    error = Column(Text, nullable=True)

    workflow_execution_id = Column(Integer, nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Float, nullable=True)


class Approval(Base):
    """A proposed action waiting for a human decision."""
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, nullable=True, index=True)
    workflow_execution_id = Column(Integer, nullable=True)
    action = Column(String(40), nullable=False)  # email_reply | crm_contact | document_approval | slack_message
    title = Column(String(255), nullable=False)
    payload = Column(JSON, nullable=False)       # editable before approval
    status = Column(String(20), nullable=False, default="pending", index=True)  # pending, approved, rejected
    result = Column(JSON, nullable=True)         # what happened when the action ran
    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    decided_at = Column(DateTime(timezone=True), nullable=True)


class KnowledgeDocument(Base):
    """A document in the company knowledge base (its chunks live in the vector store)."""
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    characters = Column(Integer, nullable=False, default=0)
    chunks = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
