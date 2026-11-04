"""
Accounts: sign-up, sign-in, profile changes, deletion, and the data the first account inherits.
"""
import logging
import threading
import time
from collections import defaultdict, deque
from typing import Optional

from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.models import OWNED_MODELS, KnowledgeDocument, User
from app.services import knowledge

log = logging.getLogger("flowmancer.accounts")
DEMO_LOCKED = "The demo account is shared, so this is turned off. Create your own free account to change it."


class AccountError(ValueError):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


# ---------- sign-in throttling (per email, in memory) ----------
MAX_FAILURES = 8
WINDOW_SECONDS = 15 * 60
_failures: dict = defaultdict(deque)
_lock = threading.Lock()


def _check_throttle(email: str):
    now = time.monotonic()
    with _lock:
        q = _failures[email]
        while q and now - q[0] > WINDOW_SECONDS:
            q.popleft()
        if len(q) >= MAX_FAILURES:
            raise AccountError("Too many failed attempts. Try again in 15 minutes.", 429)


def _record_failure(email: str):
    with _lock:
        _failures[email].append(time.monotonic())


def reset_throttle():
    with _lock:
        _failures.clear()


# ---------- accounts ----------
def normalize_email(email: str) -> str:
    return email.strip().lower()


def demo_email() -> str:
    return normalize_email(settings.DEMO_EMAIL or "")


def real_users(db: Session):
    """Every account except the shared demo account."""
    q = db.query(User)
    return q.filter(User.email != demo_email()) if demo_email() else q


def _reserved(email: str):
    if demo_email() and email == demo_email():
        raise AccountError("This email is reserved for the public demo. Use \"Try the demo\" instead.", 409)


def _not_demo(user: User):
    if user.is_demo:
        raise AccountError(DEMO_LOCKED, 403)


def register(db: Session, email: str, name: str, password: str) -> User:
    email = normalize_email(email)
    _reserved(email)
    first = real_users(db).count() == 0
    if not first and not settings.ALLOW_SIGNUPS:
        raise AccountError("Sign-ups are closed on this server.", 403)
    if db.query(User).filter(User.email == email).first():
        raise AccountError("An account with this email already exists.", 409)
    user = User(email=email, name=name.strip(), password_hash=security.hash_password(password),
                trigger_key=security.new_trigger_key())
    db.add(user)
    db.commit()
    db.refresh(user)
    if first:
        claim_unowned(db, user.id)
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    email = normalize_email(email)
    _check_throttle(email)
    user = db.query(User).filter(User.email == email).first()
    if user and not user.password_hash and user.google_sub:
        _record_failure(email)
        raise AccountError("This account signs in with Google. Use the Google button.", 401)
    if not user or not security.verify_password(password, user.password_hash):
        _record_failure(email)
        raise AccountError("Wrong email or password.", 401)
    return user


def google_sign_in(db: Session, claims: dict) -> User:
    """
    Sign in (or sign up) from verified Google ID-token claims.
    Match on Google's account id first; an existing account with the same verified email is linked.
    """
    sub = str(claims.get("sub") or "")
    email = normalize_email(claims.get("email") or "")
    if not sub or not email:
        raise AccountError("Google didn't share an email address for this account.", 400)
    if not claims.get("email_verified"):
        raise AccountError("This Google account's email address isn't verified.", 403)
    _reserved(email)

    user = db.query(User).filter(User.google_sub == sub).first()
    if user:
        return user
    user = db.query(User).filter(User.email == email).first()
    if user:
        if user.google_sub:  # the email belongs to a different Google account
            raise AccountError("This email is linked to a different Google account.", 409)
        user.google_sub = sub
        db.commit()
        db.refresh(user)
        return user

    first = real_users(db).count() == 0
    if not first and not settings.ALLOW_SIGNUPS:
        raise AccountError("Sign-ups are closed on this server.", 403)
    name = (claims.get("name") or email.split("@")[0]).strip()[:120]
    user = User(email=email, name=name, password_hash="", google_sub=sub, trigger_key=security.new_trigger_key())
    db.add(user)
    db.commit()
    db.refresh(user)
    if first:
        claim_unowned(db, user.id)
    return user


def claim_unowned(db: Session, user_id: int) -> int:
    """Give everything created before accounts existed to `user_id`. Returns rows claimed."""
    claimed = 0
    for model in OWNED_MODELS:
        claimed += db.query(model).filter(model.user_id.is_(None)).update({model.user_id: user_id},
                                                                          synchronize_session=False)
    db.commit()
    return claimed


def rotate_trigger_key(db: Session, user: User) -> User:
    _not_demo(user)
    user.trigger_key = security.new_trigger_key()
    db.commit()
    db.refresh(user)
    return user


def by_trigger_key(db: Session, key: Optional[str]) -> Optional[User]:
    if not key:
        return None
    return db.query(User).filter(User.trigger_key == key).first()


def inbox_owner(db: Session) -> Optional[User]:
    """
    The server owner: receives emails from the server's mailbox and uses the integrations set in
    backend/.env. INBOX_OWNER_EMAIL, or else the first account created. Never the demo account.
    """
    q = real_users(db)
    if settings.INBOX_OWNER_EMAIL:
        return q.filter(User.email == normalize_email(settings.INBOX_OWNER_EMAIL)).first()
    return q.order_by(User.id).first()


def server_integrations_set() -> bool:
    return bool(settings.SLACK_WEBHOOK_URL or settings.HUBSPOT_ACCESS_TOKEN or settings.WEBHOOK_URL
                or settings.imap_configured)


# ---------- settings page ----------
def _check_password(user: User, password: Optional[str]):
    """Re-check the password before a sensitive change (throttled like sign-in)."""
    _check_throttle(user.email)
    if not security.verify_password(password or "", user.password_hash):
        _record_failure(user.email)
        raise AccountError("Your current password is wrong.", 400)


def update_name(db: Session, user: User, name: str) -> User:
    _not_demo(user)
    user.name = name.strip()[:120]
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, current: Optional[str], new: str) -> User:
    """Accounts that only use Google have no password yet and can set one without the current one."""
    _not_demo(user)
    if user.password_hash:
        _check_password(user, current)
    user.password_hash = security.hash_password(new)
    db.commit()
    db.refresh(user)
    return user


def purge_user_data(db: Session, user_id: int):
    """Delete everything an account owns (rows and knowledge-base chunks), but not the account."""
    for (doc_id,) in db.query(KnowledgeDocument.id).filter(KnowledgeDocument.user_id == user_id):
        try:
            knowledge.delete_document(doc_id)
        except Exception:
            log.warning("Could not remove knowledge document %s from the index", doc_id, exc_info=True)
    for model in OWNED_MODELS:
        db.query(model).filter(model.user_id == user_id).delete(synchronize_session=False)
    db.commit()


def delete_account(db: Session, user: User, confirm_email: str, password: Optional[str]):
    _not_demo(user)
    if normalize_email(confirm_email or "") != user.email:
        raise AccountError("Type your email address exactly to confirm.", 400)
    if user.password_hash:
        _check_password(user, password)
    owner = inbox_owner(db)
    if owner is not None and owner.id == user.id and server_integrations_set():
        raise AccountError("This account owns the integrations set in the server's backend/.env. Remove them "
                           "there (or set INBOX_OWNER_EMAIL to another account) before deleting it.", 409)
    purge_user_data(db, user.id)
    db.delete(user)
    db.commit()
