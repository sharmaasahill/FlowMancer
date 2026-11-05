"""
"Forgot password": email a one-time link to set a new password.

The link holds a signed token (30 minutes) that includes a fingerprint of the current password,
so it stops working as soon as the password changes. Nothing is stored server-side.
The reply is the same whether or not the email has an account, so the form can't be used to find
out who has one. Emails are sent after the response, so timing doesn't reveal it either.
"""
import html
import logging
import threading
import time
from collections import defaultdict, deque
from typing import Optional

from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.integrations import mail
from app.models import User
from app.services import accounts

log = logging.getLogger("flowmancer.password_reset")

SENT = (f"If an account uses that email, we've sent it a link to set a new password. "
        f"The link expires in {security.RESET_MINUTES} minutes.")
INVALID = "This link is invalid, already used or expired. Ask for a new one from the sign-in page."
NOT_SET_UP = "Password reset by email isn't set up on this server."

WINDOW_SECONDS = 15 * 60
PER_EMAIL = 3
PER_IP = 10
_hits: dict = defaultdict(deque)
_lock = threading.Lock()


def _allow(key: str, limit: int) -> bool:
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > WINDOW_SECONDS:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        return True


def reset_limits():
    with _lock:
        _hits.clear()


def enabled() -> bool:
    return mail.can_send_notices()


def frontend_url(origin: Optional[str]) -> str:
    """Where the link points. Only an allowed origin is used, so the link can't be sent to another site."""
    if settings.FRONTEND_URL:
        return settings.FRONTEND_URL.rstrip("/")
    origin = (origin or "").rstrip("/")
    if origin and origin in settings.CORS_ORIGINS:
        return origin
    return settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "http://localhost:3000"


def request(db: Session, email: str, ip: str, origin: Optional[str]) -> Optional[dict]:
    """Check limits and find the account. Returns what to email, or None (no account): reply SENT either way."""
    if not enabled():
        raise accounts.AccountError(NOT_SET_UP, 503)
    email = accounts.normalize_email(email)
    if not _allow(f"ip:{ip}", PER_IP) or not _allow(f"email:{email}", PER_EMAIL):
        raise accounts.AccountError("Too many reset requests. Try again in 15 minutes.", 429)
    user = db.query(User).filter(User.email == email).first()
    if user is None or user.is_demo:  # the demo's password is public; nothing to reset
        return None
    token = security.create_reset_token(user.id, user.password_hash)
    return {"to": user.email, "name": user.name, "link": f"{frontend_url(origin)}/reset-password?token={token}",
            "has_password": user.has_password}


def send_link(to: str, name: str, link: str, has_password: bool):
    """Runs after the response has been sent."""
    action = "reset the password" if has_password else "set a password"
    text = (f"Hi {name},\n\n"
            f"Someone asked to {action} for your FlowMancer account ({to}).\n"
            f"Open this link to choose a new password. It works once and expires in {security.RESET_MINUTES} minutes:\n\n"
            f"{link}\n\n"
            "If you didn't ask for this, ignore this email. Your password won't change.\n\nFlowMancer")
    safe_name, safe_link = html.escape(name), html.escape(link, quote=True)
    body = (f"<p>Hi {safe_name},</p>"
            f"<p>Someone asked to {action} for your FlowMancer account ({html.escape(to)}). "
            f"The link works once and expires in {security.RESET_MINUTES} minutes.</p>"
            f'<p><a href="{safe_link}" style="display:inline-block;padding:10px 18px;border-radius:999px;'
            f'background:#9B1313;color:#ffffff;text-decoration:none;font-weight:600">Choose a new password</a></p>'
            f'<p style="color:#666;font-size:13px">Or paste this into your browser:<br>{safe_link}</p>'
            "<p>If you didn't ask for this, ignore this email. Your password won't change.</p><p>FlowMancer</p>")
    subject = "Reset your FlowMancer password" if has_password else "Set a password for FlowMancer"
    result = mail.send_notice(to, subject, text, body)
    if result["status"] != "success":
        log.warning("Password-reset email to %s failed: %s", to, result["detail"])


def reset(db: Session, token: str, new_password: str) -> User:
    claims = security.read_reset_token(token)
    user = db.get(User, claims["user_id"]) if claims else None
    if user is None or user.is_demo or claims["stamp"] != security.password_stamp(user.password_hash):
        raise accounts.AccountError(INVALID, 400)
    user.password_hash = security.hash_password(new_password)
    db.commit()
    db.refresh(user)
    accounts.clear_failures(user.email)  # a locked-out user can sign in straight away
    return user
