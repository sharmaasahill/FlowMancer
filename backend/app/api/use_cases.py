"""
API endpoints for specific use cases
Simplified endpoints for demonstration purposes
"""
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas import (
    LeadInput,
    LeadQualificationResult,
    EmailInput,
    EmailProcessingResult,
    DocumentInput,
    DocumentProcessingResult
)
from app.agents import (
    QuickLeadScorer,
    QuickEmailProcessor,
    QuickDocumentProcessor
)

router = APIRouter(prefix="/use-cases", tags=["use-cases"])


@router.post("/qualify-lead", response_model=dict)
async def qualify_lead(
    lead: LeadInput,
    db: Session = Depends(get_db)
):
    """
    Use Case 1: Intelligent Lead Qualification
    
    Analyzes incoming leads, scores them, and provides recommendations
    """
    try:
        # Convert lead to dict
        lead_data = lead.dict()
        
        # Process with AI agent
        scorer = QuickLeadScorer()
        result = scorer.score_lead(lead_data)
        
        return {
            "status": "success",
            "lead": lead_data,
            "result": result,
            "message": "Lead qualified successfully"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@router.post("/process-email", response_model=dict)
async def process_email(
    email: EmailInput,
    db: Session = Depends(get_db)
):
    """
    Use Case 2: Smart Email Processing
    
    Categorizes emails, analyzes sentiment, and drafts responses
    """
    try:
        # Convert email to dict
        email_data = email.dict()
        
        # Process with AI agent
        processor = QuickEmailProcessor()
        result = processor.process_email(email_data)
        
        return {
            "status": "success",
            "email": email_data,
            "result": result,
            "message": "Email processed successfully"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@router.post("/process-document", response_model=dict)
async def process_document(
    document: DocumentInput,
    db: Session = Depends(get_db)
):
    """
    Use Case 3: Document Intelligence & Automation
    
    Extracts data from documents, validates, and routes for approval
    """
    try:
        # Convert document to dict
        document_data = document.dict()
        
        # Process with AI agent
        processor = QuickDocumentProcessor()
        result = processor.process_document(document_data)
        
        return {
            "status": "success",
            "document": document_data,
            "result": result,
            "message": "Document processed successfully"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@router.post("/demo/lead-batch")
async def process_lead_batch(
    leads: list[LeadInput],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Demo endpoint: Process multiple leads in batch
    """
    results = []
    scorer = QuickLeadScorer()
    
    for lead in leads:
        try:
            result = scorer.score_lead(lead.dict())
            results.append({
                "lead": lead.dict(),
                "result": result,
                "status": "success"
            })
        except Exception as e:
            results.append({
                "lead": lead.dict(),
                "error": str(e),
                "status": "failed"
            })
    
    return {
        "total": len(leads),
        "processed": len([r for r in results if r["status"] == "success"]),
        "failed": len([r for r in results if r["status"] == "failed"]),
        "results": results
    }

