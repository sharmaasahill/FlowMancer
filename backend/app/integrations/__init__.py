"""
Outbound integrations. Every function returns a dict:
  {"status": "success" | "skipped" | "error", "detail": "..."}
"skipped" means the integration isn't connected, so callers never crash on missing setup.
Credentials are passed in explicitly; app.services.connections picks the right ones for each account.
"""
from app.integrations.slack import post_slack
from app.integrations.hubspot import upsert_contact
from app.integrations.webhook import post_webhook
from app.integrations.mail import Mailbox, append_draft, fetch_unseen, send_email

__all__ = ["post_slack", "upsert_contact", "post_webhook", "Mailbox", "fetch_unseen", "append_draft", "send_email"]
