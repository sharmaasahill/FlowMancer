"""
Run history and live progress.

GET  /api/runs                 list (filters: kind, status, mode, source; q = text search)
GET  /api/runs/export          the same list as a CSV file
GET  /api/runs/{id}            one run with input, structured output, steps, sources
GET  /api/runs/{id}/events     Server-Sent Events stream of the run until it finishes
POST /api/runs/{id}/feedback   "This is wrong": {field, correct, note}
POST /api/runs/{id}/rerun      run the same input again (?mode=crew)
"""
import asyncio
import csv
import io
import json
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session, load_only

from app.api.deps import current_user, owned
from app.core.database import get_db, session_scope
from app.models import Approval, Run, User
from app.schemas import ApprovalResponse, RunFeedback, RunList, RunResponse, RunSummary
from app.services import runs as runs_service

router = APIRouter(prefix="/runs", tags=["runs"])

FINISHED = ("completed", "failed")


def _filtered(db: Session, user: User, kind, status, mode, source, text):
    q = db.query(Run).filter(Run.user_id == user.id)
    for column, value in ((Run.kind, kind), (Run.status, status), (Run.mode, mode), (Run.source, source)):
        if value:
            q = q.filter(column == value)
    text = (text or "").strip()
    if text:  # anywhere in the input or the result
        # JSON is stored with non-ASCII letters escaped (\u0939), so look for that form too (Hindi, etc.)
        forms = {text, json.dumps(text)[1:-1]}
        patterns = ["%" + f.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%" for f in forms]
        q = q.filter(or_(*[cast(col, String).ilike(p, escape="\\")
                           for p in patterns for col in (Run.input_data, Run.output)]))
    return q


@router.get("/", response_model=RunList)
def list_runs(
    kind: Optional[str] = None,
    status: Optional[str] = None,
    mode: Optional[str] = None,
    source: Optional[str] = None,
    q: Optional[str] = Query(None, max_length=200, description="Text to find in the input or result"),
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    q = _filtered(db, user, kind, status, mode, source, q)
    total = q.count()
    # Skip the large columns (steps, sources, knowledge, crew text); the detail endpoint has them
    items = q.options(load_only(*LIST_COLUMNS)).order_by(Run.id.desc()).offset(offset).limit(limit).all()
    return RunList(total=total, items=[summarize(r) for r in items])


LIST_COLUMNS = (Run.id, Run.kind, Run.mode, Run.status, Run.source, Run.input_data, Run.output, Run.ai_model,
                Run.error, Run.created_at, Run.completed_at, Run.duration_seconds)
# Fields lists display (see summary() and verdict() in frontend/src/lib/utils.ts)
LIST_INPUT_FIELDS = ("name", "company", "email", "from_email", "subject", "file_name", "document_type")
LIST_OUTPUT_FIELDS = ("lead_score", "qualification", "category", "priority", "sentiment", "document_type",
                      "total_amount", "currency", "counterparty", "validation_status", "approval_required")


def summarize(run: Run) -> RunSummary:
    pick = lambda data, keys: {k: data[k] for k in keys if k in data} if isinstance(data, dict) else None  # noqa: E731
    return RunSummary(
        id=run.id, kind=run.kind, mode=run.mode, status=run.status, source=run.source,
        input_data=pick(run.input_data, LIST_INPUT_FIELDS), output=pick(run.output, LIST_OUTPUT_FIELDS),
        ai_model=run.ai_model, error=(run.error or "")[:300] or None, created_at=run.created_at,
        completed_at=run.completed_at, duration_seconds=run.duration_seconds,
    )


CSV_COLUMNS = (
    ("id", None), ("created_at", None), ("kind", None), ("mode", None), ("source", None), ("status", None),
    ("name", "in"), ("email", "in"), ("company", "in"), ("from_email", "in"), ("subject", "in"), ("file_name", "in"),
    ("lead_score", "out"), ("qualification", "out"), ("assigned_to", "out"), ("category", "out"),
    ("priority", "out"), ("sentiment", "out"), ("language", "out"), ("document_type", "out"),
    ("counterparty", "out"), ("total_amount", "out"), ("currency", "out"), ("validation_status", "out"),
    ("approval_required", "out"), ("summary", "out"), ("recommended_action", "out"), ("ai_model", None),
    ("duration_seconds", None), ("error", None),
)
MAX_EXPORT = 5000


def _cell(value):
    if value is None:
        return ""
    if isinstance(value, datetime):
        return (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value).isoformat()
    text = str(value)
    # Spreadsheet apps run cells starting with these as formulas; a leading ' keeps them as text
    return "'" + text if isinstance(value, str) and text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


@router.get("/export")
def export_runs(
    kind: Optional[str] = None,
    status: Optional[str] = None,
    mode: Optional[str] = None,
    source: Optional[str] = None,
    q: Optional[str] = Query(None, max_length=200),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Download the (filtered) history as CSV, newest first, up to 5,000 runs."""
    rows = _filtered(db, user, kind, status, mode, source, q).order_by(Run.id.desc()).limit(MAX_EXPORT).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([name for name, _ in CSV_COLUMNS])
    for run in rows:
        data, out = run.input_data or {}, run.output or {}
        writer.writerow([_cell(data.get(n) if src == "in" else out.get(n) if src == "out" else getattr(run, n))
                         for n, src in CSV_COLUMNS])
    name = f"flowmancer-runs-{datetime.now(timezone.utc):%Y%m%d}.csv"
    return Response("\ufeff" + buf.getvalue(), media_type="text/csv; charset=utf-8",  # BOM: Excel reads UTF-8
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/{run_id}", response_model=RunResponse)
def get_run(run_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return owned(db, Run, run_id, user, "Run")


@router.get("/{run_id}/approvals", response_model=list[ApprovalResponse])
def run_approvals(run_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    owned(db, Run, run_id, user, "Run")
    return (db.query(Approval).filter(Approval.run_id == run_id, Approval.user_id == user.id)
            .order_by(Approval.id).all())


MAX_FEEDBACK = 20


@router.post("/{run_id}/feedback", response_model=RunResponse)
def add_feedback(run_id: int, body: RunFeedback, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Report a wrong field ("This is wrong"), with the right value if known."""
    run = owned(db, Run, run_id, user, "Run")
    if run.status != "completed":
        raise HTTPException(status_code=409, detail="Only finished runs can be reported.")
    items = list(run.feedback or [])
    if len(items) >= MAX_FEEDBACK:
        raise HTTPException(status_code=409, detail=f"This run already has {MAX_FEEDBACK} reports.")
    items.append({**body.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()})
    run.feedback = items  # a new list, so the change is saved
    db.commit()
    db.refresh(run)
    return run


@router.post("/{run_id}/rerun", response_model=RunResponse, status_code=202)
def rerun(run_id: int, mode: Literal["quick", "crew"] = "crew", db: Session = Depends(get_db),
          user: User = Depends(current_user)):
    """Process the same input again, e.g. in crew mode. Returns the new run (stream /api/runs/{id}/events)."""
    run = owned(db, Run, run_id, user, "Run")
    if not run.input_data:
        raise HTTPException(status_code=422, detail="This run has no input to re-run.")
    return runs_service.run_in_background(db, run.kind, dict(run.input_data), mode, source="rerun", user_id=user.id)


def _snapshot(run_id: int) -> Optional[dict]:
    with session_scope() as db:
        run = db.get(Run, run_id)
        return RunResponse.model_validate(run).model_dump(mode="json") if run else None


@router.get("/{run_id}/events")
async def run_events(run_id: int, request: Request, db: Session = Depends(get_db),
                     user: User = Depends(current_user)):
    """Stream the run as it progresses. Each event's data is the full run JSON."""
    run = db.get(Run, run_id)
    if not run or run.user_id != user.id:
        raise HTTPException(status_code=404, detail="Run not found")

    async def stream():
        last, idle = None, 0
        while True:
            if await request.is_disconnected():
                break
            snap = await asyncio.to_thread(_snapshot, run_id)
            if snap is None:
                break
            payload = json.dumps(snap)
            if payload != last:
                yield f"data: {payload}\n\n"
                last, idle = payload, 0
            else:
                idle += 1
                if idle % 15 == 0:
                    yield ": keep-alive\n\n"
            if snap["status"] in FINISHED:
                yield "event: done\ndata: {}\n\n"
                break
            await asyncio.sleep(1)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
