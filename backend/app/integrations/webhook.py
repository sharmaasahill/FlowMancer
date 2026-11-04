"""
Generic outbound webhook. Works with Zapier "Catch Hook", n8n "Webhook" nodes, Make, etc.
"""
from typing import Any, Optional
import httpx


def post_webhook(data: Any, url: Optional[str] = None) -> dict:
    if not url:
        return {"status": "skipped", "detail": "No webhook URL connected"}
    if not url.startswith(("https://", "http://")):
        return {"status": "error", "detail": "Webhook URL must start with http:// or https://"}
    try:
        resp = httpx.post(url, json=data, timeout=20)
        resp.raise_for_status()
        return {"status": "success", "detail": f"Webhook returned {resp.status_code}"}
    except httpx.HTTPError as e:
        return {"status": "error", "detail": f"Webhook error: {e}"}
