"""
AI usage and estimated cost for the signed-in account.

GET /api/usage?days=7   requests, tokens, cost estimate, by model / feature / day, recent calls
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models import User
from app.services import usage

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("")
def get_usage(days: int = Query(7, ge=1, le=usage.MAX_DAYS), db: Session = Depends(get_db),
              user: User = Depends(current_user)):
    return usage.summary(db, user.id, days)
