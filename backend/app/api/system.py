"""
Dashboard stats and integration status.
"""
import time

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core import llm
from app.core.config import settings
from app.api.deps import current_user
from app.core.database import get_db
from app.models import User
from app.services import accounts, inbox, stats

router = APIRouter(tags=["system"])

_AI_CACHE: dict = {"at": 0.0, "value": None}
AI_CACHE_SECONDS = 60


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return stats.compute(db, user.id)


def _check_gemini(model: str) -> tuple[bool, str]:
    """Metadata lookup only; it doesn't spend any generation quota."""
    if not settings.GEMINI_API_KEY:
        return False, "GEMINI_API_KEY is not set in backend/.env"
    try:
        resp = httpx.get(f"https://generativelanguage.googleapis.com/v1beta/models/{model}",
                         headers={"x-goog-api-key": settings.GEMINI_API_KEY}, timeout=5)
    except httpx.HTTPError:
        return False, "Can't reach Google AI. Check your internet connection."
    if resp.status_code == 200:
        return True, "Connected"
    if resp.status_code in (400, 401, 403):
        return False, "Gemini rejected the API key"
    if resp.status_code == 404:
        return False, f"Model '{model}' isn't available to this key. Change GEMINI_MODEL."
    return False, f"Gemini returned HTTP {resp.status_code}"


def _check_ollama() -> tuple[bool, str]:
    try:
        names = [m.get("name", "") for m in
                 httpx.get(f"{settings.OLLAMA_BASE_URL}/api/tags", timeout=2).json().get("models", [])]
    except (httpx.HTTPError, ValueError):
        return False, "Ollama is not running"
    pulled = any(n.split(":")[0] == settings.OLLAMA_MODEL.split(":")[0] for n in names)
    return pulled, "Model ready" if pulled else f"Run: ollama pull {settings.OLLAMA_MODEL}"


def _ai_status() -> dict:
    now = time.monotonic()
    if _AI_CACHE["value"] and now - _AI_CACHE["at"] < AI_CACHE_SECONDS:
        return _AI_CACHE["value"]
    chain = llm.targets()
    main = chain[0]
    ok, detail = _check_gemini(main.model) if main.provider == "gemini" else _check_ollama()
    value = {
        "provider": main.provider,
        "model": main.label,
        "fallbacks": [t.label for t in chain[1:]],
        "reachable": ok,
        "detail": detail,
    }
    _AI_CACHE.update(at=now, value=value)
    return value


@router.get("/integrations")
def integrations(db: Session = Depends(get_db), user: User = Depends(current_user)):
    owner = accounts.inbox_owner(db)
    return {
        "ai": _ai_status(),
        "research": {"enabled": settings.RESEARCH_ENABLED, "engine": "DuckDuckGo + company website"},
        "slack": {"configured": bool(settings.SLACK_WEBHOOK_URL)},
        "hubspot": {"configured": bool(settings.HUBSPOT_ACCESS_TOKEN)},
        "webhook": {"configured": bool(settings.WEBHOOK_URL)},
        "mailbox": {**inbox.status(), "is_owner": bool(owner and owner.id == user.id),
                    "owner_email": owner.email if owner else None},
        "triggers": {
            "key": user.trigger_key,
            "form_url": "/api/triggers/form",
            "webhook_url": "/api/triggers/webhook/{workflow_id}",
        },
        "rules": {
            "hot_lead_threshold": settings.HOT_LEAD_THRESHOLD,
            "document_approval_amount": settings.DOCUMENT_APPROVAL_AMOUNT,
        },
    }
