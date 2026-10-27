"""
Inbox trigger: read unread emails over IMAP and process each one.

If an active workflow has an "inbox" trigger, each email runs through those
workflows. Otherwise it goes through the default email pipeline (which creates
a reply-draft approval).
"""
import logging
import threading
from datetime import datetime, timezone
from typing import Dict, Optional

from app.core.config import settings
from app.core.database import session_scope
from app.integrations import mail
from app.services import accounts
from app.services import engine
from app.services import runs as runs_service

log = logging.getLogger("flowmancer.inbox")

_state: Dict = {"last_poll": None, "last_count": 0, "last_error": None, "polling": False}
_stop = threading.Event()
_thread: Optional[threading.Thread] = None


def status() -> Dict:
    return {
        "configured": settings.imap_configured,
        "host": settings.IMAP_HOST or None,
        "user": settings.IMAP_USER or None,
        "folder": settings.IMAP_FOLDER,
        "auto_poll_seconds": settings.INBOX_POLL_SECONDS,
        **_state,
    }


def poll_once() -> Dict:
    """Fetch unread emails and dispatch them. Returns a summary."""
    if _state["polling"]:
        return {"status": "busy", "detail": "A poll is already running"}
    _state["polling"] = True
    try:
        with session_scope() as db:
            owner = accounts.inbox_owner(db)
        if owner is None:
            raise RuntimeError("No account to receive inbox emails yet. Create an account first.")
        messages = mail.fetch_unseen()
        dispatched = []
        with session_scope() as db:
            flows = engine.workflows_for_trigger(db, "inbox", owner.id)
            for msg in messages:
                if flows:
                    for wf in flows:
                        ex = engine.start_execution(db, wf, msg)
                        dispatched.append({"subject": msg["subject"], "workflow_execution_id": ex.id})
                else:
                    run = runs_service.run_in_background(db, "email", msg, "quick", source="inbox", user_id=owner.id)
                    dispatched.append({"subject": msg["subject"], "run_id": run.id})
        _state.update(last_poll=datetime.now(timezone.utc).isoformat(), last_count=len(messages), last_error=None)
        return {"status": "success", "fetched": len(messages), "dispatched": dispatched}
    except Exception as e:
        _state.update(last_poll=datetime.now(timezone.utc).isoformat(), last_error=str(e))
        return {"status": "error", "detail": str(e)}
    finally:
        _state["polling"] = False


def _loop():
    while not _stop.wait(settings.INBOX_POLL_SECONDS):
        result = poll_once()
        if result.get("status") == "error":
            log.warning("Inbox poll failed: %s", result.get("detail"))


def start_background_polling():
    global _thread
    if settings.INBOX_POLL_SECONDS > 0 and settings.imap_configured and _thread is None:
        _stop.clear()
        _thread = threading.Thread(target=_loop, name="flowmancer-inbox", daemon=True)
        _thread.start()


def stop_background_polling():
    global _thread
    _stop.set()
    _thread = None
