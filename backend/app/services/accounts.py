"""
Accounts: sign-up, sign-in, and the data the first account inherits.
"""
import threading
import time
from collections import defaultdict, deque
from typing import Optional

from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.models import OWNED_MODELS, User


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


def register(db: Session, email: str, name: str, password: str) -> User:
    email = normalize_email(email)
    first = db.query(User).count() == 0
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
    if not user or not security.verify_password(password, user.password_hash):
        _record_failure(email)
        raise AccountError("Wrong email or password.", 401)
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
    user.trigger_key = security.new_trigger_key()
    db.commit()
    db.refresh(user)
    return user


def by_trigger_key(db: Session, key: Optional[str]) -> Optional[User]:
    if not key:
        return None
    return db.query(User).filter(User.trigger_key == key).first()


def inbox_owner(db: Session) -> Optional[User]:
    """Account that receives emails from the configured mailbox."""
    if settings.INBOX_OWNER_EMAIL:
        return db.query(User).filter(User.email == normalize_email(settings.INBOX_OWNER_EMAIL)).first()
    return db.query(User).order_by(User.id).first()
