"""
Shared route dependencies.
"""
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models import User

_bearer = HTTPBearer(auto_error=False)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer), db: Session = Depends(get_db)) -> User:
    """The signed-in user, from the `Authorization: Bearer <token>` header."""
    user_id = decode_token(creds.credentials) if creds and creds.scheme.lower() == "bearer" else None
    user = db.get(User, user_id) if user_id else None
    if not user:
        raise HTTPException(status_code=401, detail="Please sign in", headers={"WWW-Authenticate": "Bearer"})
    return user


def owned(db: Session, model, obj_id: int, user: User, label: str):
    """Fetch a row that belongs to `user`, or 404 (never reveal other users' rows)."""
    obj = db.get(model, obj_id)
    if not obj or obj.user_id != user.id:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return obj
