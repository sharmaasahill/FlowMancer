"""
API endpoints for the three built-in use cases.

Each endpoint supports two modes via the `mode` query parameter:
- quick (default): one LLM call, takes seconds
- crew: full CrewAI multi-agent pipeline (4 agents in sequence), takes minutes on a local model

Endpoints are plain `def` so FastAPI runs the blocking LLM calls in a worker
thread instead of freezing the event loop.
"""
from typing import Literal
from fastapi import APIRouter
from app.schemas import LeadInput, EmailInput, DocumentInput
from app.agents import (
    QuickLeadScorer,
    QuickEmailProcessor,
    QuickDocumentProcessor,
    LeadQualificationCrew,
    EmailProcessingCrew,
    DocumentProcessingCrew,
)

router = APIRouter(prefix="/use-cases", tags=["use-cases"])

Mode = Literal["quick", "crew"]


def _wrap(key: str, data: dict, result: dict, mode: str, label: str) -> dict:
    """Shape every use-case response the same way."""
    ok = result.get("status") == "completed"
    return {
        "status": "success" if ok else "error",
        "mode": mode,
        key: data,
        "result": result,
        "message": f"{label} {'processed successfully' if ok else 'failed'}",
    }


@router.post("/qualify-lead", response_model=dict)
def qualify_lead(lead: LeadInput, mode: Mode = "quick"):
    """Use Case 1: score a lead and recommend next steps."""
    data = lead.model_dump()
    if mode == "crew":
        result = LeadQualificationCrew().process_lead(data)
    else:
        result = QuickLeadScorer().score_lead(data)
    return _wrap("lead", data, result, mode, "Lead")


@router.post("/process-email", response_model=dict)
def process_email(email: EmailInput, mode: Mode = "quick"):
    """Use Case 2: categorize an email, analyze sentiment, draft a reply."""
    data = email.model_dump()
    if mode == "crew":
        result = EmailProcessingCrew().process_email(data)
    else:
        result = QuickEmailProcessor().process_email(data)
    return _wrap("email", data, result, mode, "Email")


@router.post("/process-document", response_model=dict)
def process_document(document: DocumentInput, mode: Mode = "quick"):
    """Use Case 3: classify a document, extract data, validate, route."""
    data = document.model_dump()
    if mode == "crew":
        result = DocumentProcessingCrew().process_document(data)
    else:
        result = QuickDocumentProcessor().process_document(data)
    return _wrap("document", data, result, mode, "Document")


@router.post("/demo/lead-batch")
def process_lead_batch(leads: list[LeadInput]):
    """Score several leads in one request (quick mode)."""
    scorer = QuickLeadScorer()
    results = []
    for lead in leads:
        data = lead.model_dump()
        result = scorer.score_lead(data)
        results.append({
            "lead": data,
            "result": result,
            "status": "success" if result.get("status") == "completed" else "failed",
        })

    processed = sum(r["status"] == "success" for r in results)
    return {
        "total": len(leads),
        "processed": processed,
        "failed": len(leads) - processed,
        "results": results,
    }
