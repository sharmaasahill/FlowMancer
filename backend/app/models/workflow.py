"""
Database models for workflows
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class Workflow(Base):
    """
    Workflow model - represents an automation workflow
    """
    __tablename__ = "workflows"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    workflow_type = Column(String(50), nullable=False)  # lead_qualification, email_processing, document_automation
    
    # Configuration
    config = Column(JSON, nullable=True)  # Workflow-specific configuration
    is_active = Column(Boolean, default=True)
    
    # Integration settings
    n8n_workflow_id = Column(String(255), nullable=True)
    zapier_webhook_url = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Workflow(id={self.id}, name='{self.name}', type='{self.workflow_type}')>"


class WorkflowExecution(Base):
    """
    Workflow execution log - tracks each workflow run
    """
    __tablename__ = "workflow_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, nullable=False, index=True)
    
    # Execution details
    status = Column(String(50), default="pending")  # pending, running, completed, failed
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Agent execution details
    agent_logs = Column(JSON, nullable=True)  # Logs from each agent in the workflow
    
    # Timing
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    
    def __repr__(self):
        return f"<WorkflowExecution(id={self.id}, workflow_id={self.workflow_id}, status='{self.status}')>"


class AgentTask(Base):
    """
    Individual agent task within a workflow execution
    """
    __tablename__ = "agent_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, nullable=False, index=True)
    
    # Agent details
    agent_name = Column(String(255), nullable=False)
    agent_role = Column(String(255), nullable=False)
    task_description = Column(Text, nullable=False)
    
    # Task execution
    status = Column(String(50), default="pending")
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    reasoning = Column(Text, nullable=True)  # Agent's reasoning/thought process
    
    # Timestamps
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<AgentTask(id={self.id}, agent='{self.agent_name}', status='{self.status}')>"

