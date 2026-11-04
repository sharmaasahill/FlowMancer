"""
The public demo account and sample data.

"Try the demo" signs visitors into one shared account (settings.DEMO_EMAIL). It is created on first use,
filled with the sample business in demo_data, and reset to that state every night (local midnight).
The same sample data fills a new account when its owner clicks "Load sample data".
"""
import copy
import json
import logging
import re
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.core.database import session_scope
from app.models import AICall, Approval, KnowledgeDocument, Run, User, Workflow
from app.schemas import DocumentInput, EmailInput, LeadInput
from app.schemas.results import RESULT_SCHEMAS
from app.services import accounts, approvals, limits, processing
from app.services import demo_data
from app.services import knowledge as kb
from app.services.runs import automatic_actions

log = logging.getLogger("flowmancer.demo")

DEMO_RESET_DAY = "demo_reset_day"
CHECK_SECONDS = 15 * 60
INPUTS = {"lead": LeadInput, "email": EmailInput, "document": DocumentInput}
_DATE = re.compile(r"\{(date|iso):(-?\d+)\}")
_lock = threading.Lock()
_stop = threading.Event()
_thread: Optional[threading.Thread] = None


def _fill_dates(value, when: datetime):
    """Replace {date:N} / {iso:N} with the date N days after `when` (local time)."""
    if isinstance(value, str):
        def sub(m):
            day = when.astimezone(limits.local_tz()) + timedelta(days=int(m.group(2)))
            return day.strftime("%d-%m-%Y" if m.group(1) == "date" else "%Y-%m-%d")
        return _DATE.sub(sub, value)
    if isinstance(value, list):
        return [_fill_dates(v, when) for v in value]
    if isinstance(value, dict):
        return {k: _fill_dates(v, when) for k, v in value.items()}
    return value


def _at(days_ago: int, clock: str, now: datetime) -> datetime:
    hour, minute = map(int, clock.split(":"))
    day = limits.local_day_start_utc(now) - timedelta(days=days_ago)
    return day + timedelta(hours=hour, minutes=minute)


def _steps(kind: str, start: datetime, snippets: list, ai_seconds: float) -> tuple[list, float]:
    """Completed pipeline steps like a real quick run's. Returns (steps, total seconds)."""
    steps, t = [], start
    for name in processing.step_names(kind, "quick"):
        if name == processing.STEP_RESEARCH:
            status, output, seconds = "skipped", "Nothing found for this company.", 1.7
        elif name == processing.STEP_KNOWLEDGE:
            status, seconds = ("completed", 0.4) if snippets else ("skipped", 0.3)
            output = f"{len(snippets)} relevant snippets" if snippets else "No relevant knowledge-base entries"
        else:
            status, output, seconds = "completed", "Structured result ready", ai_seconds
        end = t + timedelta(seconds=seconds)
        steps.append({"name": name, "status": status, "started_at": t.isoformat(), "finished_at": end.isoformat(),
                      "output": output})
        t = end
    return steps, round((t - start).total_seconds(), 2)


def seed(db: Session, user: User, now: Optional[datetime] = None) -> int:
    """Add the sample business to an account. Returns the number of runs added."""
    now = now or datetime.now(timezone.utc)
    sample = not user.is_demo  # someone's own account: label it clearly and keep its workflows off
    prefix = "Sample - " if sample else ""
    earliest = _at(4, "09:00", now)

    docs = {}
    for name, text in demo_data.KNOWLEDGE:
        doc = KnowledgeDocument(user_id=user.id, name=prefix + name, characters=len(text), chunks=0, text=text,
                                created_at=earliest)
        db.add(doc)
        db.commit()
        db.refresh(doc)
        try:
            doc.chunks = kb.add_document(doc.id, doc.name, text)
        except Exception:  # indexed again at the next start (knowledge.rebuild_missing)
            log.warning("Could not index sample document %s", name, exc_info=True)
        docs[name] = doc
    for wf in demo_data.WORKFLOWS:
        db.add(Workflow(user_id=user.id, name=prefix + wf["name"], description=wf["description"],
                        config=copy.deepcopy(wf["config"]), is_active=not sample, created_at=earliest))
    db.commit()

    count = 0
    for (days_ago, clock), item in demo_data.RUNS:
        created = _at(days_ago, clock, now)
        if created >= now:
            continue
        kind = item["kind"]
        data = INPUTS[kind](**_fill_dates(item["input"], created)).model_dump(mode="json")
        raw = RESULT_SCHEMAS[kind](**_fill_dates(item["output"], created)).model_dump()
        output = processing.apply_rules(kind, raw, data)
        snippets = [{"doc_id": docs[n].id, "doc_name": docs[n].name, "text": docs[n].text[:800], "score": score}
                    for n, score in item["knowledge"]]
        out_tokens = len(json.dumps(output, ensure_ascii=False)) // 3
        in_tokens = 950 + len(json.dumps(data, ensure_ascii=False)) // 3 + sum(len(s["text"]) for s in snippets) // 4
        ai_seconds = round(1.9 + out_tokens / 160, 1)
        steps, duration = _steps(kind, created, snippets, ai_seconds)
        run = Run(user_id=user.id, kind=kind, mode="quick", status="completed", source=item["source"],
                  input_data=data, output=output, steps=steps, research=[] if kind == "lead" else None,
                  knowledge=snippets, actions=automatic_actions(kind, data, output),
                  ai_model=demo_data.AI_MODEL, created_at=created,
                  completed_at=created + timedelta(seconds=duration), duration_seconds=duration)
        db.add(run)
        db.flush()
        db.add(AICall(user_id=user.id, feature=kind, mode="quick", run_id=run.id, provider="gemini",
                      model=demo_data.AI_MODEL.split(" ")[0], status="ok", fallback=False, requests=1,
                      input_tokens=in_tokens, output_tokens=out_tokens, seconds=ai_seconds,
                      created_at=created + timedelta(seconds=duration - ai_seconds)))
        for proposal in approvals.default_proposals(kind, data, output):
            db.add(Approval(user_id=user.id, run_id=run.id, action=proposal["action"],
                            title=proposal["title"][:255], payload=proposal["payload"], status="pending",
                            created_at=run.completed_at))
        count += 1
    db.commit()
    return count


def reset(db: Session, user: User) -> int:
    """Put the demo account back to its starting state (the account row and its id stay)."""
    accounts.purge_user_data(db, user.id)
    user.name = demo_data.DEMO_NAME
    user.password_hash = security.hash_password(settings.DEMO_PASSWORD)
    user.trigger_key = security.new_trigger_key()
    user.google_sub = None
    db.commit()
    now = datetime.now(timezone.utc).replace(microsecond=0)
    limits.set_state(db, limits.DEMO_RESET_AT, now.isoformat())
    limits.set_state(db, DEMO_RESET_DAY, limits.local_today(now).isoformat())
    return seed(db, user, now)


def _find(db: Session) -> Optional[User]:
    return db.query(User).filter(User.email == accounts.demo_email()).first() if accounts.demo_email() else None


def ensure_demo_user(db: Session) -> User:
    """The demo account, created and filled with sample data on first use."""
    with _lock:
        user = _find(db)
        if user:
            return user
        user = User(email=accounts.demo_email(), name=demo_data.DEMO_NAME,
                    password_hash=security.hash_password(settings.DEMO_PASSWORD),
                    trigger_key=security.new_trigger_key())
        db.add(user)
        try:
            db.commit()
        except IntegrityError:  # created by another worker a moment ago
            db.rollback()
            return _find(db)
        db.refresh(user)
        reset(db, user)
        return user


def maybe_reset() -> bool:
    """Reset the demo account if it hasn't been reset today (local time)."""
    if not settings.DEMO_ENABLED:
        return False
    with _lock, session_scope() as db:
        user = _find(db)
        if user is None or limits.get_state(db, DEMO_RESET_DAY) == limits.local_today().isoformat():
            return False
        runs = reset(db, user)
    log.info("Demo account reset with %d sample runs", runs)
    return True


def _loop():
    if _stop.wait(20):  # let startup finish first
        return
    while True:
        try:
            maybe_reset()
        except Exception:
            log.warning("Demo reset failed", exc_info=True)
        if _stop.wait(CHECK_SECONDS):
            return


def start_scheduler():
    global _thread
    if settings.DEMO_ENABLED and _thread is None:
        _stop.clear()
        _thread = threading.Thread(target=_loop, name="flowmancer-demo-reset", daemon=True)
        _thread.start()


def stop_scheduler():
    global _thread
    _stop.set()
    _thread = None
