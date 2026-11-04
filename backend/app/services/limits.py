"""
Daily run limits, and small server-wide values kept in the app_state table.

The demo account may start DEMO_DAILY_RUN_LIMIT runs per day; other accounts DAILY_RUN_LIMIT (0 = no limit),
except the server owner, who has no limit.
"A day" is midnight to midnight at LOCAL_UTC_OFFSET_MINUTES (India by default).
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import AppState, Run, User
from app.services import accounts

DEMO_RESET_AT = "demo_reset_at"


class RunLimitError(Exception):
    """Today's run limit is used up (returned to the client as HTTP 429)."""


# ---------- app_state ----------
def get_state(db: Session, key: str) -> Optional[str]:
    row = db.get(AppState, key)
    return row.value if row else None


def set_state(db: Session, key: str, value: str):
    row = db.get(AppState, key)
    if row is None:
        db.add(AppState(key=key, value=value))
    else:
        row.value = value
    db.commit()


# ---------- local day ----------
def local_tz() -> timezone:
    return timezone(timedelta(minutes=settings.LOCAL_UTC_OFFSET_MINUTES))


def tz_label() -> str:
    minutes = settings.LOCAL_UTC_OFFSET_MINUTES
    if minutes == 330:
        return "IST"
    sign = "+" if minutes >= 0 else "-"
    return f"UTC{sign}{abs(minutes) // 60:02d}:{abs(minutes) % 60:02d}"


def local_today(now: Optional[datetime] = None) -> date:
    return (now or datetime.now(timezone.utc)).astimezone(local_tz()).date()


def local_day_start_utc(now: Optional[datetime] = None) -> datetime:
    local = (now or datetime.now(timezone.utc)).astimezone(local_tz())
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


# ---------- limits ----------
def daily_limit(db: Session, user: User) -> int:
    if user.is_demo:
        return settings.DEMO_DAILY_RUN_LIMIT
    if settings.DAILY_RUN_LIMIT <= 0:
        return 0
    owner = accounts.inbox_owner(db)
    return 0 if owner is not None and owner.id == user.id else settings.DAILY_RUN_LIMIT


def check(db: Session, user_id: Optional[int]):
    """Raise RunLimitError if the account can't start another run today."""
    user = db.get(User, user_id) if user_id is not None else None
    limit = daily_limit(db, user) if user else 0
    if limit <= 0:
        return
    since = local_day_start_utc()
    if user.is_demo:  # runs before tonight's reset (the sample data) don't count
        reset_at = get_state(db, DEMO_RESET_AT)
        if reset_at:
            since = max(since, datetime.fromisoformat(reset_at))
    # Compared in Python too: SQLite stores naive UTC with varying precision
    rows = (db.query(Run.created_at)
            .filter(Run.user_id == user.id, Run.created_at >= (since - timedelta(seconds=1)).replace(tzinfo=None))
            .all())
    used = sum(1 for (at,) in rows if at and (at.replace(tzinfo=timezone.utc) if at.tzinfo is None else at) >= since)
    if used >= limit:
        who = "The demo account has" if user.is_demo else "You've"
        tail = " Create your own free account to keep going." if user.is_demo else ""
        raise RunLimitError(f"{who} reached today's limit of {limit} runs. It resets at midnight "
                            f"({tz_label()}).{tail}")
