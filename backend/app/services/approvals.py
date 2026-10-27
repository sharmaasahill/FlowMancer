"""
Human-in-the-loop approvals.

The AI proposes an action (save a reply draft, push a contact to the CRM, approve a
document, post to Slack). A person approves, edits or rejects it. Only on approval
does the action actually run.
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.integrations import append_draft, post_slack, post_webhook, upsert_contact
from app.models import Approval

ACTIONS = ("email_reply", "crm_contact", "document_approval", "slack_message")


class ApprovalError(ValueError):
    pass


# ---------- payload builders (from a run's structured output) ----------
def email_reply_payload(email: Dict, output: Dict) -> Dict:
    return {
        "to": email.get("from_email", ""),
        "subject": email.get("subject", ""),
        "body": output.get("draft_reply", ""),
        "in_reply_to": email.get("message_id"),
    }


def crm_contact_payload(lead: Dict, output: Dict) -> Dict:
    name = (lead.get("name") or "").strip()
    first, _, last = name.partition(" ")
    return {
        "email": lead.get("email", ""),
        "firstname": first,
        "lastname": last,
        "company": lead.get("company") or "",
        "phone": lead.get("phone") or "",
        "lead_score": output.get("lead_score"),
        "qualification": output.get("qualification"),
        "notes": output.get("recommended_action", ""),
    }


def document_approval_payload(doc: Dict, output: Dict) -> Dict:
    return {
        "file_name": doc.get("file_name"),
        "document_type": output.get("document_type"),
        "counterparty": output.get("counterparty"),
        "total_amount": output.get("total_amount"),
        "currency": output.get("currency"),
        "due_date": output.get("due_date"),
        "summary": output.get("summary", ""),
        "approver": output.get("approver"),
        "issues": output.get("issues", []),
    }


def default_proposals(kind: str, data: Dict, output: Dict) -> List[Dict]:
    """Which approvals a finished run should create when it isn't part of a custom workflow."""
    if kind == "lead" and output.get("qualification") in ("High", "Medium"):
        return [{"action": "crm_contact",
                 "title": f"Add {data.get('name')} ({output.get('lead_score')}/100) to CRM",
                 "payload": crm_contact_payload(data, output)}]
    if kind == "email" and output.get("category") != "spam" and output.get("draft_reply"):
        return [{"action": "email_reply",
                 "title": f"Reply to {data.get('from_email')}: {data.get('subject', '')[:80]}",
                 "payload": email_reply_payload(data, output)}]
    if kind == "document" and output.get("approval_required"):
        amount = output.get("total_amount")
        money = f" {amount:g} {output.get('currency') or ''}".rstrip() if amount is not None else ""
        return [{"action": "document_approval",
                 "title": f"Approve {output.get('document_type')} from {output.get('counterparty') or 'unknown'}{money}",
                 "payload": document_approval_payload(data, output)}]
    return []


def proposal_for_action(action: str, kind: str, data: Dict, output: Dict) -> Dict:
    """Build a specific approval (used by workflow 'Request approval' nodes)."""
    if action == "email_reply":
        if kind != "email":
            raise ApprovalError("An email reply approval needs an email AI step before it")
        payload = email_reply_payload(data, output)
        title = f"Reply to {data.get('from_email')}"
    elif action == "crm_contact":
        if kind != "lead":
            raise ApprovalError("A CRM approval needs a lead AI step before it")
        payload = crm_contact_payload(data, output)
        title = f"Add {data.get('name')} to CRM"
    elif action == "document_approval":
        if kind != "document":
            raise ApprovalError("A document approval needs a document AI step before it")
        payload = document_approval_payload(data, output)
        title = f"Approve {output.get('document_type')} from {output.get('counterparty') or 'unknown'}"
    else:
        raise ApprovalError(f"Unknown approval action: {action}")
    return {"action": action, "title": title, "payload": payload}


def create(db: Session, proposal: Dict, user_id: Optional[int], run_id: Optional[int] = None,
           workflow_execution_id: Optional[int] = None) -> Approval:
    approval = Approval(
        user_id=user_id,
        run_id=run_id,
        workflow_execution_id=workflow_execution_id,
        action=proposal["action"],
        title=proposal["title"][:255],
        payload=proposal["payload"],
        status="pending",
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)
    return approval


# ---------- execution ----------
def execute_action(action: str, payload: Dict) -> Dict:
    steps: List[Dict] = []
    if action == "email_reply":
        if not payload.get("to") or not payload.get("body"):
            raise ApprovalError("Reply needs 'to' and 'body'")
        steps.append({"target": "mailbox draft",
                      **append_draft(payload["to"], payload.get("subject", ""), payload["body"],
                                     payload.get("in_reply_to"))})
    elif action == "crm_contact":
        steps.append({"target": "HubSpot", **upsert_contact(payload)})
    elif action == "document_approval":
        amount = payload.get("total_amount")
        money = f" for {amount:g} {payload.get('currency') or ''}".rstrip() if amount is not None else ""
        text = (f"Approved: {payload.get('document_type')} from {payload.get('counterparty') or 'unknown'}"
                f"{money}. {payload.get('summary', '')}")
        steps.append({"target": "Slack", **post_slack(text)})
        steps.append({"target": "Webhook", **post_webhook({"event": "document_approved", "document": payload})})
    elif action == "slack_message":
        if not payload.get("text"):
            raise ApprovalError("Slack message needs 'text'")
        steps.append({"target": "Slack", **post_slack(payload["text"])})
    else:
        raise ApprovalError(f"Unknown action: {action}")

    statuses = {s["status"] for s in steps}
    overall = "error" if "error" in statuses else "success" if "success" in statuses else "skipped"
    return {"status": overall, "steps": steps}


def _decide(db: Session, approval: Approval, status: str, note: Optional[str]):
    approval.status = status
    approval.note = note
    approval.decided_at = datetime.now(timezone.utc)


def approve(db: Session, approval: Approval, edits: Optional[Dict], note: Optional[str]) -> Approval:
    if approval.status != "pending":
        raise ApprovalError(f"Approval is already {approval.status}")
    payload = dict(approval.payload or {})
    if edits:
        unknown = set(edits) - set(payload)
        if unknown:
            raise ApprovalError(f"Unknown fields: {', '.join(sorted(unknown))}")
        payload.update(edits)
    approval.payload = payload
    approval.result = execute_action(approval.action, payload)
    _decide(db, approval, "approved", note)
    db.commit()
    db.refresh(approval)
    return approval


def reject(db: Session, approval: Approval, note: Optional[str]) -> Approval:
    if approval.status != "pending":
        raise ApprovalError(f"Approval is already {approval.status}")
    _decide(db, approval, "rejected", note)
    db.commit()
    db.refresh(approval)
    return approval
