"""
Accounts.

POST /api/auth/register            {email, name, password} -> {token, user}
POST /api/auth/login               {email, password}       -> {token, user}
GET  /api/auth/me                  the signed-in user (includes the trigger key)
POST /api/auth/trigger-key/rotate  new key for the public form/webhook triggers
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_token
from app.models import User
from app.schemas.workflow import UTCDateTime
from app.services import accounts

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterInput(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=120)
    password: str = Field(..., min_length=8, max_length=200)


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=200)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    trigger_key: str
    created_at: Optional[UTCDateTime] = None


class Session_(BaseModel):
    token: str
    user: UserOut


def _session(user: User) -> Session_:
    return Session_(token=create_token(user.id), user=UserOut.model_validate(user))


@router.get("/config")
def auth_config(db: Session = Depends(get_db)):
    """Whether sign-up is possible (used by the sign-in page)."""
    has_users = db.query(User).count() > 0
    return {"signups_open": settings.ALLOW_SIGNUPS or not has_users, "has_users": has_users}


@router.post("/register", response_model=Session_, status_code=201)
def register(body: RegisterInput, db: Session = Depends(get_db)):
    try:
        user = accounts.register(db, body.email, body.name, body.password)
    except accounts.AccountError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return _session(user)


@router.post("/login", response_model=Session_)
def login(body: LoginInput, db: Session = Depends(get_db)):
    try:
        user = accounts.authenticate(db, body.email, body.password)
    except accounts.AccountError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return _session(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.post("/trigger-key/rotate", response_model=UserOut)
def rotate_key(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return accounts.rotate_trigger_key(db, user)  # same session as current_user

