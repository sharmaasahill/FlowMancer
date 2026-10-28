"""
Accounts.

POST /api/auth/register            {email, name, password} -> {token, user}
POST /api/auth/login               {email, password}       -> {token, user}
POST /api/auth/google              {credential}            -> {token, user}   (Sign in with Google)
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
from app.core import security
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


class GoogleInput(BaseModel):
    credential: str = Field(..., min_length=20, max_length=4096, description="ID token from Google Identity Services")


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    trigger_key: str
    google_linked: bool = False
    has_password: bool = True
    created_at: Optional[UTCDateTime] = None


class Session_(BaseModel):
    token: str
    user: UserOut


def _session(user: User) -> Session_:
    return Session_(token=create_token(user.id), user=UserOut.model_validate(user))


@router.get("/config")
def auth_config(db: Session = Depends(get_db)):
    """Whether sign-up is possible, and the Google client ID if Google sign-in is set up (public values)."""
    has_users = db.query(User).count() > 0
    return {"signups_open": settings.ALLOW_SIGNUPS or not has_users, "has_users": has_users,
            "google_client_id": settings.GOOGLE_CLIENT_ID or None}


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


@router.post("/google", response_model=Session_)
def google(body: GoogleInput, db: Session = Depends(get_db)):
    """Exchange a Google ID token (from the Sign in with Google button) for a FlowMancer session."""
    try:
        claims = security.verify_google_token(body.credential)
        user = accounts.google_sign_in(db, claims)
    except security.GoogleTokenError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except accounts.AccountError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return _session(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.post("/trigger-key/rotate", response_model=UserOut)
def rotate_key(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return accounts.rotate_trigger_key(db, user)  # same session as current_user

