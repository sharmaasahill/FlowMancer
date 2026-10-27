"""
Workflow executions (start one with POST /api/workflows/{id}/run).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import WorkflowExecution
from app.schemas import WorkflowExecutionResponse

router = APIRouter(prefix="/executions", tags=["executions"])


@router.get("/{execution_id}", response_model=WorkflowExecutionResponse)
def get_execution(execution_id: int, db: Session = Depends(get_db)):
    ex = db.get(WorkflowExecution, execution_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Execution not found")
    return ex
