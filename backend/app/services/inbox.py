"""
Inbox trigger: read an account's unread emails over IMAP and process each one.

Every account reads its own connected Gmail (the server owner may also use the server's IMAP_* mailbox).
If one of the account's active workflows has an "inbox" trigger, each email runs through those
workflows. Otherwise it goes through the default email pipeline (which creates a reply approval).
"""
import logging
import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import session_scope
from app.integrations import mail
from app.models import Connection, User
from app.services import accounts, connections
from app.services import engine
from app.services import runs as runs_service

log = logging.getLogger("flowmancer.inbox")

_states: Dict[int, Dict] = {}
_lock = threading.Lock()
_stop = threading.Event()
_thread: Optional[threading.Thread] = None


def _state(user_id: int) -> Dict:
    with _lock:
        return _states.setdefault(user_id, {"last_poll": None, "last_count": 0, "last_error": None, "polling": False})


def status(db: Session, user: User) -> Dict:
    integ = connections.for_user(user.id, db)
    box = integ.mailbox
    return {
        "configured": box is not None,
        "can_send": integ.can_send(),
        "source": integ.sources.get("gmail"),
        "host": box.host if box else None,
        "user": box.user if box else None,
        "folder": box.folder if box else "INBOX",
        "auto_poll_seconds": settings.INBOX_POLL_SECONDS,
        **_state(user.id),
    }


def poll_once(user_id: int) -> Dict:
    """Fetch the account's unread emails and dispatch them. Returns a summary."""
    state = _state(user_id)
    with _lock:
        if state["polling"]:
            return {"status": "busy", "detail": "A poll is already running"}
        state["polling"] = True
    try:
        box = connections.for_user(user_id).mailbox
        if box is None:
            raise RuntimeError("No mailbox connected. Connect Gmail on the Integrations page.")
        messages = mail.fetch_unseen(box)
        dispatched = []
        with session_scope() as db:
            flows = engine.workflows_for_trigger(db, "inbox", user_id)
            for msg in messages:
                if flows:
                    for wf in flows:
                        ex = engine.start_execution(db, wf, msg)
                        dispatched.append({"subject": msg["subject"], "workflow_execution_id": ex.id})
                else:
                    run = runs_service.run_in_background(db, "email", msg, "quick", source="inbox", user_id=user_id)
                    dispatched.append({"subject": msg["subject"], "run_id": run.id})
        state.update(last_poll=datetime.now(timezone.utc).isoformat(), last_count=len(messages), last_error=None)
        return {"status": "success", "fetched": len(messages), "dispatched": dispatched}
    except Exception as e:
        state.update(last_poll=datetime.now(timezone.utc).isoformat(), last_error=str(e))
        return {"status": "error", "detail": str(e)}
    finally:
        state["polling"] = False


def _accounts_with_mailbox() -> List[int]:
    with session_scope() as db:
        ids = {uid for (uid,) in db.query(Connection.user_id).filter(Connection.provider == "gmail")}
        owner = accounts.inbox_owner(db) if settings.imap_configured else None
        if owner is not None:
            ids.add(owner.id)
    return sorted(i for i in ids if i is not None)


def _loop():
    while not _stop.wait(settings.INBOX_POLL_SECONDS):
        try:
            user_ids = _accounts_with_mailbox()
        except Exception:
            log.warning("Inbox poll: could not list accounts", exc_info=True)
            continue
        for user_id in user_ids:
            result = poll_once(user_id)
            if result.get("status") == "error":
                log.warning("Inbox poll for account %s failed: %s", user_id, result.get("detail"))


def start_background_polling():
    global _thread
    if settings.INBOX_POLL_SECONDS > 0 and _thread is None:
        _stop.clear()
        _thread = threading.Thread(target=_loop, name="flowmancer-inbox", daemon=True)
        _thread.start()


def stop_background_polling():
    global _thread
    _stop.set()
    _thread = None
