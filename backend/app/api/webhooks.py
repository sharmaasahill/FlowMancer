"""
API endpoints for webhook handling
"""
from fastapi import APIRouter, Request, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from typing import Dict, Any
from app.core.database import get_db
from app.schemas import WebhookPayload
from app.integrations import N8nIntegration, ZapierIntegration

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/n8n")
async def n8n_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Receive webhooks from n8n
    """
    try:
        payload = await request.json()
        
        # Process webhook
        n8n = N8nIntegration()
        result = n8n.handle_webhook(payload)
        
        return {
            "status": "received",
            "message": "n8n webhook processed",
            "data": result
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@router.post("/zapier")
async def zapier_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Receive webhooks from Zapier
    """
    try:
        payload = await request.json()
        
        # Process webhook
        zapier = ZapierIntegration()
        result = zapier.handle_webhook(payload)
        
        return {
            "status": "received",
            "message": "Zapier webhook processed",
            "data": result
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@router.post("/generic")
async def generic_webhook(
    payload: WebhookPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Generic webhook endpoint for any integration
    """
    try:
        # Process generic webhook
        # This can trigger workflows based on event type
        
        return {
            "status": "received",
            "event": payload.event,
            "message": "Webhook processed successfully"
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

