"""
Use-case endpoints.

Synchronous (wait for the result):
  POST /api/use-cases/qualify-lead | process-email | process-document   ?mode=quick|crew

Background jobs (return immediately; follow progress at /api/runs/{id}/events):
  POST /api/use-cases/jobs/{kind}            kind = lead | email | document
  POST /api/use-cases/process-document/upload  (multipart file upload, runs in background)

Sync endpoints are plain `def`, so FastAPI runs them in a worker thread and the
server stays responsive while the model works.
"""
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.config import settings
from app.core.database import get_db
from app.models import User
from app.schemas import DocumentInput, EmailInput, LeadInput, RunResponse
from app.services import runs as runs_service
from app.services.extract import ExtractionError, extract_text

router = APIRouter(prefix="/use-cases", tags=["use-cases"])

Mode = Literal["quick", "crew"]
Kind = Literal["lead", "email", "document"]
INPUTS = {"lead": LeadInput, "email": EmailInput, "document": DocumentInput}


def _run(db: Session, user: User, kind: str, data, mode: str) -> RunResponse:
    run = runs_service.run_now(db, kind, data.model_dump(mode="json"), mode, user_id=user.id)
    return RunResponse.model_validate(run)


@router.post("/qualify-lead", response_model=RunResponse)
def qualify_lead(lead: LeadInput, mode: Mode = "quick", db: Session = Depends(get_db),
                 user: User = Depends(current_user)):
    """Score a lead using real web research and recommend next steps."""
    return _run(db, user, "lead", lead, mode)


@router.post("/process-email", response_model=RunResponse)
def process_email(email: EmailInput, mode: Mode = "quick", db: Session = Depends(get_db),
                  user: User = Depends(current_user)):
    """Categorize an email, judge sentiment and draft a reply grounded in the knowledge base."""
    return _run(db, user, "email", email, mode)


@router.post("/process-document", response_model=RunResponse)
def process_document(document: DocumentInput, mode: Mode = "quick", db: Session = Depends(get_db),
                     user: User = Depends(current_user)):
    """Classify a document, extract its data, validate it and decide approval."""
    return _run(db, user, "document", document, mode)


@router.post("/jobs/{kind}", response_model=RunResponse, status_code=202)
def start_job(kind: Kind, payload: dict, mode: Mode = "quick", db: Session = Depends(get_db),
              user: User = Depends(current_user)):
    """Start processing in the background. Poll /api/runs/{id} or stream /api/runs/{id}/events."""
    try:
        data = INPUTS[kind](**payload).model_dump(mode="json")
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
    run = runs_service.run_in_background(db, kind, data, mode, source="ui", user_id=user.id)
    return RunResponse.model_validate(run)


@router.post("/process-document/upload", response_model=RunResponse, status_code=202)
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form("auto"),
    mode: Mode = Form("quick"),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Upload a PDF/TXT/MD/CSV/HTML file and process it in the background."""
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status_code=413, detail=f"File larger than {settings.MAX_UPLOAD_MB} MB")
    try:
        text = extract_text(file.filename or "", data)
    except ExtractionError as e:
        raise HTTPException(status_code=422, detail=str(e))
    doc = DocumentInput(document_type=document_type, file_name=file.filename, file_content=text[:200000])
    run = runs_service.run_in_background(db, "document", doc.model_dump(mode="json"), mode, source="upload",
                                         user_id=user.id)
    return RunResponse.model_validate(run)
