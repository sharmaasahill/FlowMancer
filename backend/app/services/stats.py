"""
Real dashboard statistics, computed from stored runs and approvals.
Aggregation is done in Python so it works the same on SQLite and PostgreSQL.
"""
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Dict

from sqlalchemy.orm import Session

from app.models import Approval, KnowledgeDocument, Run, Workflow, WorkflowExecution

DAYS = 14


def _as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def compute(db: Session) -> Dict:
    runs = db.query(Run).all()
    completed = [r for r in runs if r.status == "completed"]
    failed = [r for r in runs if r.status == "failed"]
    durations = [r.duration_seconds for r in completed if r.duration_seconds is not None]

    today = datetime.now(timezone.utc).date()
    days = [today - timedelta(days=i) for i in range(DAYS - 1, -1, -1)]
    per_day = {d.isoformat(): {"date": d.isoformat(), "lead": 0, "email": 0, "document": 0} for d in days}
    for r in runs:
        if r.created_at:
            key = _as_utc(r.created_at).date().isoformat()
            if key in per_day and r.kind in per_day[key]:
                per_day[key][r.kind] += 1

    leads = [r.output for r in completed if r.kind == "lead" and r.output]
    emails = [r.output for r in completed if r.kind == "email" and r.output]
    docs = [r.output for r in completed if r.kind == "document" and r.output]
    scores = [o.get("lead_score") for o in leads if isinstance(o.get("lead_score"), int)]

    return {
        "totals": {
            "runs": len(runs),
            "completed": len(completed),
            "failed": len(failed),
            "in_progress": len([r for r in runs if r.status in ("queued", "running")]),
            "success_rate": round(len(completed) / (len(completed) + len(failed)) * 100, 1)
                            if (completed or failed) else None,
            "avg_duration_seconds": round(sum(durations) / len(durations), 1) if durations else None,
            "workflows": db.query(Workflow).count(),
            "active_workflows": db.query(Workflow).filter(Workflow.is_active.is_(True)).count(),
            "workflow_executions": db.query(WorkflowExecution).count(),
            "pending_approvals": db.query(Approval).filter(Approval.status == "pending").count(),
            "knowledge_documents": db.query(KnowledgeDocument).count(),
        },
        "by_kind": dict(Counter(r.kind for r in runs)),
        "by_mode": dict(Counter(r.mode for r in runs)),
        "runs_per_day": list(per_day.values()),
        "leads": {
            "count": len(leads),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
            "by_qualification": {q: sum(1 for o in leads if o.get("qualification") == q)
                                 for q in ("High", "Medium", "Low")},
        },
        "emails": {
            "count": len(emails),
            "by_category": dict(Counter(o.get("category") for o in emails)),
            "by_priority": dict(Counter(o.get("priority") for o in emails)),
            "by_sentiment": dict(Counter(o.get("sentiment") for o in emails)),
        },
        "documents": {
            "count": len(docs),
            "by_status": dict(Counter(o.get("validation_status") for o in docs)),
            "approval_required": sum(1 for o in docs if o.get("approval_required")),
        },
    }
