"""Slack notifications via an Incoming Webhook URL (https://api.slack.com/messaging/webhooks)."""
from typing import Optional
import httpx
from app.core.config import settings


def post_slack(text: str, webhook_url: Optional[str] = None) -> dict:
    url = webhook_url or settings.SLACK_WEBHOOK_URL
    if not url:
        return {"status": "skipped", "detail": "SLACK_WEBHOOK_URL not configured"}
    if not url.startswith("https://"):
        return {"status": "error", "detail": "Slack webhook URL must start with https://"}
    try:
        resp = httpx.post(url, json={"text": text[:3900]}, timeout=15)
        resp.raise_for_status()
        return {"status": "success", "detail": "Posted to Slack"}
    except httpx.HTTPError as e:
        return {"status": "error", "detail": f"Slack error: {e}"}
