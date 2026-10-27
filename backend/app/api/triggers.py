"""
Triggers: ways for work to arrive without anyone pasting it in.

Public (identified by the account's trigger key, ?key=... or the X-FlowMancer-Key header):
  POST /api/triggers/form                 website "contact us" form -> lead
  POST /api/triggers/webhook/{workflow}   any JSON -> run that workflow

Signed in:
  GET  /api/triggers/inbox                inbox status
  POST /api/triggers/inbox/poll           read unread emails now (inbox owner only)
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.config import settings
from app.core.database import get_db
from app.models import User, Workflow
from app.schemas import LeadInput
from app.services import accounts, engine, inbox
from app.services import runs as runs_service

router = APIRouter(prefix="/triggers", tags=["triggers"])

FIELD_ALIASES = {
    "name": ("name", "full_name", "fullname", "your-name", "your_name"),
    "email": ("email", "email_address", "your-email", "your_email", "mail"),
    "company": ("company", "company_name", "organization", "organisation"),
    "phone": ("phone", "phone_number", "tel", "mobile"),
    "message": ("message", "comments", "comment", "your-message", "inquiry", "body"),
}
RESERVED = {"key"}


def trigger_owner(request: Request, db: Session = Depends(get_db)) -> User:
    """The account a public trigger call belongs to, from its trigger key."""
    key = request.headers.get("X-FlowMancer-Key") or request.query_params.get("key")
    user = accounts.by_trigger_key(db, key)
    if not user:
        raise HTTPException(status_code=401, detail="Missing or invalid trigger key. Find yours on the Integrations page.")
    return user


async def _payload(request: Request) -> dict:
    ctype = request.headers.get("content-type", "")
    if "application/json" in ctype:
        try:
            body = await request.json()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid JSON")
    else:
        body = dict(await request.form())
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Body must be an object")
    for k in RESERVED:
        body.pop(k, None)
    return body


def normalize_form(raw: dict) -> dict:
    lowered = {str(k).strip().lower(): v for k, v in raw.items()}
    lead = {}
    for field, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if lowered.get(alias):
                lead[field] = str(lowered[alias]).strip()
                break
    if "name" not in lead:
        first, last = lowered.get("first_name") or lowered.get("firstname"), lowered.get("last_name") or lowered.get("lastname")
        if first or last:
            lead["name"] = f"{first or ''} {last or ''}".strip()
    used = {a for aliases in FIELD_ALIASES.values() for a in aliases} | {"first_name", "firstname", "last_name", "lastname"}
    extra = {k: v for k, v in lowered.items() if k not in used}
    if extra:
        lead["additional_data"] = extra
    lead["source"] = "website_form"
    return lead


@router.post("/form", status_code=202)
async def form_trigger(request: Request, workflow_id: Optional[int] = None, db: Session = Depends(get_db),
                       owner: User = Depends(trigger_owner)):
    """Point your website form here. Accepts JSON or regular form posts."""
    raw = await _payload(request)
    try:
        lead = LeadInput(**normalize_form(raw)).model_dump(mode="json")
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=[{"field": err["loc"][-1], "error": err["msg"]} for err in e.errors()])

    if workflow_id is not None:
        wf = db.get(Workflow, workflow_id)
        if not wf or wf.user_id != owner.id:
            raise HTTPException(status_code=404, detail="Workflow not found")
        flows = [wf]
    else:
        flows = engine.workflows_for_trigger(db, "form", owner.id)

    if flows:
        try:
            ids = [engine.start_execution(db, wf, lead).id for wf in flows]
        except engine.WorkflowError as e:
            raise HTTPException(status_code=422, detail=str(e))
        return {"status": "accepted", "workflow_execution_ids": ids}
    run = runs_service.run_in_background(db, "lead", lead, "quick", source="form", user_id=owner.id)
    return {"status": "accepted", "run_id": run.id}


@router.post("/webhook/{workflow_id}", status_code=202)
async def workflow_webhook(workflow_id: int, request: Request, db: Session = Depends(get_db),
                           owner: User = Depends(trigger_owner)):
    """Run a workflow with any JSON body as its input (for Zapier, n8n, Make, your own code)."""
    wf = db.get(Workflow, workflow_id)
    if not wf or wf.user_id != owner.id:
        raise HTTPException(status_code=404, detail="Workflow not found")
    data = await _payload(request)
    try:
        ex = engine.start_execution(db, wf, data)
    except engine.WorkflowError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"status": "accepted", "workflow_execution_id": ex.id}


def _is_inbox_owner(db: Session, user: User) -> bool:
    owner = accounts.inbox_owner(db)
    return owner is not None and owner.id == user.id


@router.get("/inbox")
def inbox_status(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return {**inbox.status(), "is_owner": _is_inbox_owner(db, user)}


@router.post("/inbox/poll")
def poll_inbox(db: Session = Depends(get_db), user: User = Depends(current_user)):
    if not settings.imap_configured:
        raise HTTPException(status_code=400, detail="Inbox not configured: set IMAP_HOST, IMAP_USER and IMAP_PASSWORD")
    if not _is_inbox_owner(db, user):
        raise HTTPException(status_code=403, detail="The inbox belongs to another account (INBOX_OWNER_EMAIL).")
    result = inbox.poll_once()
    if result["status"] == "error":
        raise HTTPException(status_code=502, detail=result["detail"])
    return result
