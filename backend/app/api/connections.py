"""
Each account's own integrations.

GET    /api/connections               status of slack, hubspot, gmail, webhook
PUT    /api/connections/{provider}    connect (credentials are live-tested, then stored encrypted)
       slack {webhook_url} | hubspot {token} | gmail {email, app_password} | webhook {url}
DELETE /api/connections/{provider}    disconnect
"""
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models import User
from app.services import connections

router = APIRouter(prefix="/connections", tags=["connections"])


@router.get("/")
def list_connections(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return connections.status(db, user)


@router.put("/{provider}")
def connect(provider: str, fields: Dict[str, str], db: Session = Depends(get_db),
            user: User = Depends(current_user)):
    try:
        return connections.connect(db, user, provider, fields)
    except connections.ConnectError as e:
        raise HTTPException(status_code=e.status, detail=str(e))


@router.delete("/{provider}")
def disconnect(provider: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    try:
        return connections.disconnect(db, user, provider)
    except connections.ConnectError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
