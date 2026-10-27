"""
Company knowledge base.

GET    /api/knowledge             list documents
POST   /api/knowledge/text        add pasted text
POST   /api/knowledge/upload      add a file (PDF/TXT/MD/CSV/HTML)
DELETE /api/knowledge/{id}
GET    /api/knowledge/search?q=   see what the AI would retrieve
"""
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import KnowledgeDocument
from app.schemas import KnowledgeDocumentResponse, KnowledgeTextInput
from app.services import knowledge as kb
from app.services.extract import ExtractionError, extract_text

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


def _add(db: Session, name: str, text: str) -> KnowledgeDocument:
    doc = KnowledgeDocument(name=name[:255], characters=len(text), chunks=0)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    try:
        doc.chunks = kb.add_document(doc.id, doc.name, text)
    except Exception as e:
        db.delete(doc)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Could not index document: {e}")
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/", response_model=List[KnowledgeDocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    return db.query(KnowledgeDocument).order_by(KnowledgeDocument.id.desc()).all()


@router.post("/text", response_model=KnowledgeDocumentResponse, status_code=201)
def add_text(body: KnowledgeTextInput, db: Session = Depends(get_db)):
    return _add(db, body.name, body.text)


@router.post("/upload", response_model=KnowledgeDocumentResponse, status_code=201)
async def add_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    limit = settings.MAX_UPLOAD_MB * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status_code=413, detail=f"File larger than {settings.MAX_UPLOAD_MB} MB")
    try:
        text = extract_text(file.filename or "", data)
    except ExtractionError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return _add(db, file.filename or "upload", text)


@router.delete("/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(KnowledgeDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    kb.delete_document(doc_id)
    db.delete(doc)
    db.commit()
    return {"deleted": doc_id}


@router.get("/search")
def search(q: str = Query(..., min_length=1, max_length=2000), k: int = Query(4, ge=1, le=10)):
    return {"query": q, "results": kb.search(q, k=k)}
