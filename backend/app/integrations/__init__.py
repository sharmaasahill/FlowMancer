"""
Outbound integrations. Every function returns a dict:
  {"status": "success" | "skipped" | "error", "detail": "..."}
"skipped" means the integration isn't configured, so callers never crash on missing setup.
"""
from app.integrations.slack import post_slack
from app.integrations.hubspot import upsert_contact
from app.integrations.webhook import post_webhook
from app.integrations.mail import fetch_unseen, append_draft

__all__ = ["post_slack", "upsert_contact", "post_webhook", "fetch_unseen", "append_draft"]
