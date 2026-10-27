"""
Runs: create, execute (now or in the background) and record AI processing.

Background jobs use a small thread pool. A local model processes one request at a
time anyway, so 2 workers keeps the queue moving without overloading Ollama.
"""
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import session_scope
from app.integrations import post_slack
from app.models import KnowledgeDocument, Run
from app.services import approvals
from app.services import processing
from app.services.progress import StepTracker

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="flowmancer-run")


def create_run(db: Session, kind: str, data: Dict, mode: str = "quick", source: str = "api", *,
               user_id: Optional[int], workflow_execution_id: Optional[int] = None) -> Run:
    if kind not in processing.KINDS:
        raise ValueError(f"Unknown kind: {kind}")
    if mode not in processing.MODES:
        raise ValueError(f"Unknown mode: {mode}")
    tracker = StepTracker(processing.step_names(kind, mode))
    run = Run(user_id=user_id, kind=kind, mode=mode, status="queued", source=source, input_data=data,
              steps=tracker.steps, workflow_execution_id=workflow_execution_id)
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _save_steps(run_id: int, steps: List[Dict]):
    with session_scope() as db:
        run = db.get(Run, run_id)
        if run:
            run.steps = steps
            db.commit()


def automatic_actions(kind: str, data: Dict, output: Dict) -> List[Dict]:
    """Notifications that don't need approval."""
    actions = []
    if kind == "lead" and output.get("lead_score", 0) >= settings.HOT_LEAD_THRESHOLD:
        text = (f"Hot lead: {data.get('name')} from {data.get('company') or 'unknown company'} "
                f"scored {output['lead_score']}/100. Next: {output.get('recommended_action', '')}")
        actions.append({"action": "slack_alert", "reason": "hot lead", **post_slack(text)})
    if kind == "email" and output.get("priority") == "urgent" and output.get("category") != "spam":
        text = (f"Urgent email from {data.get('from_email')}: {data.get('subject')}. "
                f"{output.get('summary', '')} (team: {output.get('assigned_team', '')})")
        actions.append({"action": "slack_alert", "reason": "urgent email", **post_slack(text)})
    return actions


def execute_run(run_id: int, followups: bool = True) -> Run:
    """Run the pipeline for an existing run. Always returns the (refreshed) run; never raises."""
    with session_scope() as db:
        run = db.get(Run, run_id)
        kind, mode, data, user_id = run.kind, run.mode, dict(run.input_data or {}), run.user_id
        run.status = "running"
        db.commit()
        doc_ids = [d for (d,) in db.query(KnowledgeDocument.id).filter(KnowledgeDocument.user_id == user_id)]

    tracker = StepTracker(processing.step_names(kind, mode), on_change=lambda s: _save_steps(run_id, s))
    started = time.monotonic()
    try:
        outcome = processing.process(kind, data, mode, tracker, doc_ids=doc_ids)
        error = None
    except Exception as e:
        tracker.fail_running(str(e))
        outcome, error = None, str(e)

    with session_scope() as db:
        run = db.get(Run, run_id)
        run.steps = [dict(s) for s in tracker.steps]
        run.duration_seconds = round(time.monotonic() - started, 2)
        run.completed_at = datetime.now(timezone.utc)
        if error:
            run.status, run.error = "failed", error
        else:
            run.status = "completed"
            run.output = outcome.output
            run.raw_text = outcome.raw_text
            run.research = outcome.research
            run.knowledge = outcome.knowledge
            run.ai_model = outcome.ai_model
            if followups:
                run.actions = automatic_actions(kind, data, outcome.output)
        db.commit()

        if not error and followups:
            for proposal in approvals.default_proposals(kind, data, outcome.output):
                approvals.create(db, proposal, user_id=user_id, run_id=run_id)

        db.refresh(run)
        db.expunge(run)
        return run


def run_now(db: Session, kind: str, data: Dict, mode: str = "quick", source: str = "api", *,
            user_id: Optional[int]) -> Run:
    run = create_run(db, kind, data, mode, source, user_id=user_id)
    return execute_run(run.id)


def run_in_background(db: Session, kind: str, data: Dict, mode: str = "quick", source: str = "api", *,
                      user_id: Optional[int]) -> Run:
    run = create_run(db, kind, data, mode, source, user_id=user_id)
    _executor.submit(execute_run, run.id)
    return run


def submit(fn, *args, **kwargs):
    """Run any callable on the shared background pool."""
    return _executor.submit(fn, *args, **kwargs)
