"""
Human approval queue.

GET  /api/approvals?status=pending
POST /api/approvals/{id}/approve   body: {"payload": {...edits}, "note": "..."}
POST /api/approvals/{id}/reject    body: {"note": "..."}
"""
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import current_user, owned
from app.core.database import get_db
from app.models import Approval, User
from app.schemas import ApprovalDecision, ApprovalResponse
from app.services import approvals as service

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.get("/", response_model=List[ApprovalResponse])
def list_approvals(
    status: Optional[str] = Query(None, pattern="^(pending|approved|rejected)$"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    q = db.query(Approval).filter(Approval.user_id == user.id)
    if status:
        q = q.filter(Approval.status == status)
    return q.order_by(Approval.id.desc()).limit(limit).all()


@router.get("/{approval_id}", response_model=ApprovalResponse)
def get_approval(approval_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return owned(db, Approval, approval_id, user, "Approval")


@router.post("/{approval_id}/approve", response_model=ApprovalResponse)
def approve(approval_id: int, decision: ApprovalDecision = Body(default_factory=ApprovalDecision),
            db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Approve (optionally with edits). The action runs immediately."""
    try:
        return service.approve(db, owned(db, Approval, approval_id, user, "Approval"), decision.payload, decision.note)
    except service.ApprovalError as e:
        raise HTTPException(status_code=409 if "already" in str(e) else 422, detail=str(e))


@router.post("/{approval_id}/reject", response_model=ApprovalResponse)
def reject(approval_id: int, decision: ApprovalDecision = Body(default_factory=ApprovalDecision),
           db: Session = Depends(get_db), user: User = Depends(current_user)):
    try:
        return service.reject(db, owned(db, Approval, approval_id, user, "Approval"), decision.note)
    except service.ApprovalError as e:
        raise HTTPException(status_code=409, detail=str(e))
