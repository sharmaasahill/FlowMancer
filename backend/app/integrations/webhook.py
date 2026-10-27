"""
Generic outbound webhook. Works with Zapier "Catch Hook", n8n "Webhook" nodes, Make, etc.
"""
from typing import Any, Optional
import httpx
from app.core.config import settings


def post_webhook(data: Any, url: Optional[str] = None) -> dict:
    target = url or settings.WEBHOOK_URL
    if not target:
        return {"status": "skipped", "detail": "No webhook URL configured"}
    if not target.startswith(("https://", "http://")):
        return {"status": "error", "detail": "Webhook URL must start with http:// or https://"}
    try:
        resp = httpx.post(target, json=data, timeout=20)
        resp.raise_for_status()
        return {"status": "success", "detail": f"Webhook returned {resp.status_code}"}
    except httpx.HTTPError as e:
        return {"status": "error", "detail": f"Webhook error: {e}"}
