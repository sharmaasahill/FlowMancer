"""
API endpoints for workflow execution
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, Any
from app.core.database import get_db
from app.models import Workflow, WorkflowExecution, AgentTask
from app.schemas import WorkflowExecutionCreate, WorkflowExecutionResponse
from app.agents import (
    QuickLeadScorer,
    QuickEmailProcessor,
    QuickDocumentProcessor
)
from app.integrations import N8nIntegration, ZapierIntegration

router = APIRouter(prefix="/executions", tags=["executions"])


async def execute_workflow_async(
    execution_id: int,
    workflow: Workflow,
    input_data: Dict[str, Any],
    db: Session
):
    """
    Execute workflow asynchronously
    """
    try:
        # Get workflow execution record
        execution = db.query(WorkflowExecution).filter(
            WorkflowExecution.id == execution_id
        ).first()
        
        execution.status = "running"
        db.commit()
        
        # Execute based on workflow type
        result = None
        
        if workflow.workflow_type == "lead_qualification":
            scorer = QuickLeadScorer()
            result = scorer.score_lead(input_data)
            
        elif workflow.workflow_type == "email_processing":
            processor = QuickEmailProcessor()
            result = processor.process_email(input_data)
            
        elif workflow.workflow_type == "document_automation":
            processor = QuickDocumentProcessor()
            result = processor.process_document(input_data)
        
        # Trigger integrations if configured
        if workflow.n8n_workflow_id:
            n8n = N8nIntegration()
            await n8n.trigger_workflow(workflow.n8n_workflow_id, result)
        
        if workflow.zapier_webhook_url:
            zapier = ZapierIntegration()
            await zapier.send_to_zapier(result, workflow.zapier_webhook_url)
        
        # Update execution record
        execution.status = "completed"
        execution.output_data = result
        execution.completed_at = datetime.utcnow()
        
        if execution.started_at:
            duration = (execution.completed_at - execution.started_at).total_seconds()
            execution.duration_seconds = int(duration)
        
        db.commit()
        
    except Exception as e:
        execution.status = "failed"
        execution.error_message = str(e)
        execution.completed_at = datetime.utcnow()
        db.commit()


@router.post("/", response_model=WorkflowExecutionResponse)
async def create_execution(
    execution_data: WorkflowExecutionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Create and execute a workflow
    """
    # Get workflow
    workflow = db.query(Workflow).filter(
        Workflow.id == execution_data.workflow_id
    ).first()
    
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if not workflow.is_active:
        raise HTTPException(status_code=400, detail="Workflow is not active")
    
    # Create execution record
    db_execution = WorkflowExecution(
        workflow_id=execution_data.workflow_id,
        input_data=execution_data.input_data,
        status="pending"
    )
    db.add(db_execution)
    db.commit()
    db.refresh(db_execution)
    
    # Execute workflow in background
    background_tasks.add_task(
        execute_workflow_async,
        db_execution.id,
        workflow,
        execution_data.input_data,
        db
    )
    
    return db_execution


@router.get("/{execution_id}", response_model=WorkflowExecutionResponse)
def get_execution(
    execution_id: int,
    db: Session = Depends(get_db)
):
    """
    Get execution status and results
    """
    execution = db.query(WorkflowExecution).filter(
        WorkflowExecution.id == execution_id
    ).first()
    
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    return execution

