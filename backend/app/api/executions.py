"""
Workflow executions (start one with POST /api/workflows/{id}/run).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import current_user, owned
from app.core.database import get_db
from app.models import User, WorkflowExecution
from app.schemas import WorkflowExecutionResponse

router = APIRouter(prefix="/executions", tags=["executions"])


@router.get("/{execution_id}", response_model=WorkflowExecutionResponse)
def get_execution(execution_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return owned(db, WorkflowExecution, execution_id, user, "Execution")
