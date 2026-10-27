"""
Workflow management. Graph workflows are validated on save.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Workflow, WorkflowExecution
from app.schemas import (
    WorkflowCreate,
    WorkflowExecutionResponse,
    WorkflowResponse,
    WorkflowRunRequest,
    WorkflowUpdate,
)
from app.services import engine

router = APIRouter(prefix="/workflows", tags=["workflows"])


def _get(db: Session, workflow_id: int) -> Workflow:
    wf = db.get(Workflow, workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


def _validate(config):
    if engine.has_graph(config):
        errors = engine.validate_graph(config)
        if errors:
            raise HTTPException(status_code=422, detail=errors)


@router.get("/", response_model=List[WorkflowResponse])
def list_workflows(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Workflow).order_by(Workflow.id.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=WorkflowResponse, status_code=201)
def create_workflow(workflow: WorkflowCreate, db: Session = Depends(get_db)):
    _validate(workflow.config)
    wf = Workflow(**workflow.model_dump())
    db.add(wf)
    db.commit()
    db.refresh(wf)
    return wf


@router.get("/{workflow_id}", response_model=WorkflowResponse)
def get_workflow(workflow_id: int, db: Session = Depends(get_db)):
    return _get(db, workflow_id)


@router.put("/{workflow_id}", response_model=WorkflowResponse)
def update_workflow(workflow_id: int, update: WorkflowUpdate, db: Session = Depends(get_db)):
    wf = _get(db, workflow_id)
    data = update.model_dump(exclude_unset=True)
    if "config" in data:
        _validate(data["config"])
    for field, value in data.items():
        setattr(wf, field, value)
    db.commit()
    db.refresh(wf)
    return wf


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: int, db: Session = Depends(get_db)):
    db.delete(_get(db, workflow_id))
    db.commit()
    return {"message": "Workflow deleted"}


@router.post("/{workflow_id}/run", response_model=WorkflowExecutionResponse, status_code=202)
def run_workflow(workflow_id: int, body: WorkflowRunRequest, db: Session = Depends(get_db)):
    """Run the workflow now with the given input (in the background)."""
    try:
        return engine.start_execution(db, _get(db, workflow_id), body.input_data)
    except engine.WorkflowError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/{workflow_id}/executions", response_model=List[WorkflowExecutionResponse])
def list_workflow_executions(workflow_id: int, limit: int = 20, db: Session = Depends(get_db)):
    return (db.query(WorkflowExecution).filter(WorkflowExecution.workflow_id == workflow_id)
            .order_by(WorkflowExecution.id.desc()).limit(limit).all())
