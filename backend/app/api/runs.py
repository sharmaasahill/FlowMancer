"""
Run history and live progress.

GET /api/runs                 list (filters: kind, status, mode, source)
GET /api/runs/{id}            one run with input, structured output, steps, sources
GET /api/runs/{id}/events     Server-Sent Events stream of the run until it finishes
"""
import asyncio
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, load_only

from app.api.deps import current_user, owned
from app.core.database import get_db, session_scope
from app.models import Approval, Run, User
from app.schemas import ApprovalResponse, RunList, RunResponse, RunSummary

router = APIRouter(prefix="/runs", tags=["runs"])

FINISHED = ("completed", "failed")


@router.get("/", response_model=RunList)
def list_runs(
    kind: Optional[str] = None,
    status: Optional[str] = None,
    mode: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    q = db.query(Run).filter(Run.user_id == user.id)
    for column, value in ((Run.kind, kind), (Run.status, status), (Run.mode, mode), (Run.source, source)):
        if value:
            q = q.filter(column == value)
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


@router.get("/{run_id}", response_model=RunResponse)
def get_run(run_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return owned(db, Run, run_id, user, "Run")


@router.get("/{run_id}/approvals", response_model=list[ApprovalResponse])
def run_approvals(run_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    owned(db, Run, run_id, user, "Run")
    return (db.query(Approval).filter(Approval.run_id == run_id, Approval.user_id == user.id)
            .order_by(Approval.id).all())


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
