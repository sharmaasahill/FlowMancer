"""
Workflow executions.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Workflow, WorkflowExecution
from app.schemas import WorkflowExecutionCreate, WorkflowExecutionResponse
from app.services import engine

router = APIRouter(prefix="/executions", tags=["executions"])


@router.post("/", response_model=WorkflowExecutionResponse, status_code=202)
def create_execution(body: WorkflowExecutionCreate, db: Session = Depends(get_db)):
    """Run a workflow in the background. Poll GET /api/executions/{id} for progress."""
    wf = db.get(Workflow, body.workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    try:
        return engine.start_execution(db, wf, body.input_data)
    except engine.WorkflowError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/{execution_id}", response_model=WorkflowExecutionResponse)
def get_execution(execution_id: int, db: Session = Depends(get_db)):
    ex = db.get(WorkflowExecution, execution_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Execution not found")
    return ex
