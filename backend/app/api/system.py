"""
Dashboard stats and integration status.
"""
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.llm import model_label
from app.services import inbox, stats

router = APIRouter(tags=["system"])


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    return stats.compute(db)


def _ai_status() -> dict:
    provider = settings.AI_PROVIDER.lower()
    info = {"provider": provider, "model": model_label(), "reachable": None, "detail": ""}
    if provider == "ollama":
        try:
            resp = httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=2)
            names = [m.get("name", "") for m in resp.json().get("models", [])]
            pulled = any(n.split(":")[0] == settings.OLLAMA_MODEL.split(":")[0] for n in names)
            info["reachable"] = True
            info["detail"] = "Model ready" if pulled else f"Run: ollama pull {settings.OLLAMA_MODEL}"
        except (httpx.HTTPError, ValueError):
            info.update(reachable=False, detail="Ollama is not running")
    else:
        info.update(reachable=bool(settings.OPENAI_API_KEY),
                    detail="API key set" if settings.OPENAI_API_KEY else "OPENAI_API_KEY missing")
    return info


@router.get("/integrations")
def integrations():
    return {
        "ai": _ai_status(),
        "research": {"enabled": settings.RESEARCH_ENABLED, "engine": "DuckDuckGo + company website"},
        "slack": {"configured": bool(settings.SLACK_WEBHOOK_URL)},
        "hubspot": {"configured": bool(settings.HUBSPOT_ACCESS_TOKEN)},
        "webhook": {"configured": bool(settings.ZAPIER_WEBHOOK_URL)},
        "mailbox": inbox.status(),
        "triggers": {
            "secret_required": bool(settings.TRIGGER_SECRET),
            "form_url": "/api/triggers/form",
            "webhook_url": "/api/triggers/webhook/{workflow_id}",
        },
        "rules": {
            "hot_lead_threshold": settings.HOT_LEAD_THRESHOLD,
            "document_approval_amount": settings.DOCUMENT_APPROVAL_AMOUNT,
        },
    }
