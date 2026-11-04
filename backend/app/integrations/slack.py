"""Slack notifications via an Incoming Webhook URL (https://api.slack.com/messaging/webhooks)."""
from typing import Optional
import httpx


def post_slack(text: str, webhook_url: Optional[str] = None) -> dict:
    if not webhook_url:
        return {"status": "skipped", "detail": "Slack not connected"}
    if not webhook_url.startswith("https://"):
        return {"status": "error", "detail": "Slack webhook URL must start with https://"}
    try:
        resp = httpx.post(webhook_url, json={"text": text[:3900]}, timeout=15)
        resp.raise_for_status()
        return {"status": "success", "detail": "Posted to Slack"}
    except httpx.HTTPError as e:
        return {"status": "error", "detail": f"Slack error: {e}"}
