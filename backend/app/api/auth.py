"""
Accounts.

POST /api/auth/register            {email, name, password} -> {token, user}
POST /api/auth/login               {email, password}       -> {token, user}
POST /api/auth/google              {access_token} or {credential} -> {token, user}   (Sign in with Google)
POST /api/auth/demo                sign in to the shared demo account (no password needed)
GET  /api/auth/me                  the signed-in user (includes the trigger key)
PATCH /api/auth/me                 {name}
POST /api/auth/password            {current_password, new_password}
POST /api/auth/forgot-password     {email} emails a one-time link to set a new password
POST /api/auth/reset-password      {token, new_password} from that link
DELETE /api/auth/me                {confirm_email, password} deletes the account and all its data
POST /api/auth/trigger-key/rotate  new key for the public form/webhook triggers
"""
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.config import settings
from app.core.database import get_db
from app.core import security
from app.core.security import create_token
from app.models import User
from app.schemas.workflow import UTCDateTime
from app.services import accounts, demo, password_reset

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterInput(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=120)
    password: str = Field(..., min_length=8, max_length=200)


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=200)


class GoogleInput(BaseModel):
    """Send one of the two: an ID token, or an access token from Google's sign-in popup."""
    credential: Optional[str] = Field(None, min_length=20, max_length=4096, description="ID token from Google Identity Services")
    access_token: Optional[str] = Field(None, min_length=20, max_length=4096,
                                        description="Access token from Google's sign-in popup (scopes: openid email profile)")

    @model_validator(mode="after")
    def exactly_one(self):
        if bool(self.credential) == bool(self.access_token):
            raise ValueError("Send either credential or access_token")
        return self


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    trigger_key: str
    google_linked: bool = False
    has_password: bool = True
    is_demo: bool = False
    created_at: Optional[UTCDateTime] = None


class Session_(BaseModel):
    token: str
    user: UserOut


def _session(user: User) -> Session_:
    return Session_(token=create_token(user.id), user=UserOut.model_validate(user))


@router.get("/config")
def auth_config(db: Session = Depends(get_db)):
    """Whether sign-up is possible, and the Google client ID if Google sign-in is set up (public values)."""
    has_users = accounts.real_users(db).count() > 0
    return {"signups_open": settings.ALLOW_SIGNUPS or not has_users, "has_users": has_users,
            "google_client_id": settings.GOOGLE_CLIENT_ID or None, "demo_enabled": settings.DEMO_ENABLED,
            "password_reset": password_reset.enabled()}


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
    """Exchange a Google ID token or access token (from Sign in with Google) for a FlowMancer session."""
    try:
        claims = (security.verify_google_token(body.credential) if body.credential
                  else security.verify_google_access_token(body.access_token))
        user = accounts.google_sign_in(db, claims)
    except security.GoogleTokenError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except accounts.AccountError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return _session(user)


@router.post("/demo", response_model=Session_)
def demo_session(db: Session = Depends(get_db)):
    """Sign in to the shared demo account (sandboxed, reset every night). Works even when sign-ups are closed."""
    if not settings.DEMO_ENABLED:
        raise HTTPException(status_code=404, detail="The demo is turned off on this server.")
    return _session(demo.ensure_demo_user(db))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


class NameInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class PasswordInput(BaseModel):
    current_password: Optional[str] = Field(None, max_length=200)
    new_password: str = Field(..., min_length=8, max_length=200)


class DeleteInput(BaseModel):
    confirm_email: str = Field(..., max_length=320)
    password: Optional[str] = Field(None, max_length=200)


class ForgotInput(BaseModel):
    email: EmailStr


class ResetInput(BaseModel):
    token: str = Field(..., min_length=20, max_length=2000)
    new_password: str = Field(..., min_length=8, max_length=200)


def _account_call(fn, *args):
    try:
        return fn(*args)
    except accounts.AccountError as e:
        raise HTTPException(status_code=e.status, detail=str(e))


@router.patch("/me", response_model=UserOut)
def update_me(body: NameInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _account_call(accounts.update_name, db, user, body.name)


@router.post("/password", response_model=UserOut)
def change_password(body: PasswordInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _account_call(accounts.change_password, db, user, body.current_password, body.new_password)


@router.delete("/me", status_code=204)
def delete_me(body: DeleteInput, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _account_call(accounts.delete_account, db, user, body.confirm_email, body.password)


@router.post("/forgot-password")
def forgot_password(body: ForgotInput, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    """Email a link to set a new password. The answer is the same whether or not the account exists."""
    ip = request.client.host if request.client else "unknown"
    job = _account_call(password_reset.request, db, body.email, ip, request.headers.get("origin"))
    if job:
        background.add_task(password_reset.send_link, **job)
    return {"detail": password_reset.SENT}


@router.post("/reset-password")
def reset_password(body: ResetInput, db: Session = Depends(get_db)):
    _account_call(password_reset.reset, db, body.token, body.new_password)
    return {"detail": "Password changed. Sign in with your new password."}


@router.post("/trigger-key/rotate", response_model=UserOut)
def rotate_key(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _account_call(accounts.rotate_trigger_key, db, user)  # same session as current_user

