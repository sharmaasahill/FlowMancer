"""
Human approval queue.

GET  /api/approvals?status=pending
POST /api/approvals/{id}/approve   body: {"payload": {...edits}, "note": "..."}
POST /api/approvals/{id}/reject    body: {"note": "..."}
"""
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Approval
from app.schemas import ApprovalDecision, ApprovalResponse
from app.services import approvals as service

router = APIRouter(prefix="/approvals", tags=["approvals"])


def _get(db: Session, approval_id: int) -> Approval:
    approval = db.get(Approval, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    return approval


@router.get("/", response_model=List[ApprovalResponse])
def list_approvals(
    status: Optional[str] = Query(None, pattern="^(pending|approved|rejected)$"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Approval)
    if status:
        q = q.filter(Approval.status == status)
    return q.order_by(Approval.id.desc()).limit(limit).all()


@router.get("/{approval_id}", response_model=ApprovalResponse)
def get_approval(approval_id: int, db: Session = Depends(get_db)):
    return _get(db, approval_id)


@router.post("/{approval_id}/approve", response_model=ApprovalResponse)
def approve(approval_id: int, decision: ApprovalDecision = Body(default_factory=ApprovalDecision),
            db: Session = Depends(get_db)):
    """Approve (optionally with edits). The action runs immediately."""
    try:
        return service.approve(db, _get(db, approval_id), decision.payload, decision.note)
    except service.ApprovalError as e:
        raise HTTPException(status_code=409 if "already" in str(e) else 422, detail=str(e))


@router.post("/{approval_id}/reject", response_model=ApprovalResponse)
def reject(approval_id: int, decision: ApprovalDecision = Body(default_factory=ApprovalDecision),
           db: Session = Depends(get_db)):
    try:
        return service.reject(db, _get(db, approval_id), decision.note)
    except service.ApprovalError as e:
        raise HTTPException(status_code=409, detail=str(e))
