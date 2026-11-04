"""
Per-account integrations: each account connects its own Slack, HubSpot, Gmail and webhook.

Credentials are checked with a live test before they are saved, and stored encrypted.
The server's .env integrations (SLACK_WEBHOOK_URL, HUBSPOT_ACCESS_TOKEN, WEBHOOK_URL, IMAP_*)
belong to the server owner only (accounts.inbox_owner); an account's own connection wins over them.
"""
from dataclasses import dataclass, field
from datetime import timezone
from typing import Dict, Optional
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.core.database import session_scope
from app.integrations import hubspot, mail
from app.integrations.mail import Mailbox
from app.integrations.slack import post_slack
from app.integrations.hubspot import upsert_contact
from app.integrations.webhook import post_webhook
from app.models import Connection, User
from app.services import accounts, research

PROVIDERS = ("slack", "hubspot", "gmail", "webhook")
NOT_CONNECTED = {"status": "skipped", "detail": "Gmail not connected"}


class ConnectError(ValueError):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


@dataclass
class UserIntegrations:
    """The integrations one account may use. Empty fields mean "not connected" (actions are skipped)."""
    slack_url: Optional[str] = None
    hubspot_token: Optional[str] = None
    webhook_url: Optional[str] = None
    mailbox: Optional[Mailbox] = None
    sources: Dict[str, str] = field(default_factory=dict)  # provider -> "account" | "server"
    server_owner: bool = False  # may call private addresses (e.g. a local n8n); everyone else only public ones

    def slack(self, text: str) -> dict:
        return post_slack(text, self.slack_url)

    def crm(self, contact: dict) -> dict:
        return upsert_contact(contact, self.hubspot_token)

    def webhook(self, data, url: Optional[str] = None) -> dict:
        if url and not self.server_owner and not research.is_public_host(urlparse(url).hostname or ""):
            return {"status": "error", "detail": "Webhook URL must be a public internet address"}
        return post_webhook(data, url or self.webhook_url)

    def draft(self, to: str, subject: str, body: str, in_reply_to: Optional[str] = None) -> dict:
        if self.mailbox is None:  # never fall back to the server mailbox
            return dict(NOT_CONNECTED)
        return mail.append_draft(to, subject, body, in_reply_to, box=self.mailbox)

    def send(self, to: str, subject: str, body: str, in_reply_to: Optional[str] = None) -> dict:
        if self.mailbox is None:
            return dict(NOT_CONNECTED)
        return mail.send_email(to, subject, body, in_reply_to, box=self.mailbox)


def _mailbox(secret: dict) -> Mailbox:
    return Mailbox(user=secret["email"], password=secret["app_password"])


def _build(db: Session, user_id: int) -> UserIntegrations:
    integ = UserIntegrations()
    owner = accounts.inbox_owner(db)
    if owner is not None and owner.id == user_id:
        integ.server_owner = True
        server = {"slack": settings.SLACK_WEBHOOK_URL, "hubspot": settings.HUBSPOT_ACCESS_TOKEN,
                  "webhook": settings.WEBHOOK_URL, "gmail": mail.server_mailbox()}
        integ.slack_url, integ.hubspot_token = server["slack"] or None, server["hubspot"] or None
        integ.webhook_url, integ.mailbox = server["webhook"] or None, server["gmail"]
        integ.sources = {p: "server" for p, v in server.items() if v}
    for row in db.query(Connection).filter(Connection.user_id == user_id):
        secret = security.decrypt(row.secret)
        if not secret:
            continue
        if row.provider == "slack":
            integ.slack_url = secret["url"]
        elif row.provider == "hubspot":
            integ.hubspot_token = secret["token"]
        elif row.provider == "webhook":
            integ.webhook_url = secret["url"]
        elif row.provider == "gmail":
            integ.mailbox = _mailbox(secret)
        integ.sources[row.provider] = "account"
    return integ


def for_user(user_id: Optional[int], db: Optional[Session] = None) -> UserIntegrations:
    if user_id is None:
        return UserIntegrations()
    if db is not None:
        return _build(db, user_id)
    with session_scope() as s:
        return _build(s, user_id)


def _iso(dt) -> Optional[str]:
    if dt is None:
        return None
    return (dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt).isoformat()


def status(db: Session, user: User) -> Dict[str, dict]:
    integ = _build(db, user.id)
    rows = {c.provider: c for c in db.query(Connection).filter(Connection.user_id == user.id)}
    server_labels = {"slack": "Set on the server", "hubspot": "Set on the server", "webhook": "Set on the server",
                     "gmail": settings.IMAP_USER}
    out = {}
    for p in PROVIDERS:
        source = integ.sources.get(p)
        row = rows.get(p) if source == "account" else None
        out[p] = {"configured": bool(source), "source": source,
                  "label": row.label if row else server_labels[p] if source else None,
                  "updated_at": _iso(row.updated_at or row.created_at) if row else None}
    return out


def _tail(text: str) -> str:
    return text[-4:] if len(text) > 8 else ""


def _verify(provider: str, fields: Dict[str, str]) -> tuple[dict, str]:
    """Validate and live-test the credentials. Returns (secret, label)."""
    if provider == "slack":
        url = (fields.get("webhook_url") or "").strip()
        if not url.startswith("https://hooks.slack.com/"):
            raise ConnectError("Paste a Slack incoming webhook URL. It starts with https://hooks.slack.com/")
        result = post_slack("FlowMancer is connected. Hot leads and urgent emails will be posted here.", url)
        if result["status"] != "success":
            raise ConnectError(f"Slack didn't accept the test message. {result['detail']}")
        return {"url": url}, f"Webhook ending {_tail(url)}"
    if provider == "hubspot":
        token = (fields.get("token") or "").strip()
        if len(token) < 20:
            raise ConnectError("Paste your HubSpot Service Key (Development > Keys > Service Keys).")
        try:
            hubspot.check_token(token)
        except RuntimeError as e:
            raise ConnectError(str(e))
        return {"token": token}, f"Key ending {_tail(token)}"
    if provider == "gmail":
        address = accounts.normalize_email(fields.get("email") or "")
        password = "".join((fields.get("app_password") or "").split())  # Google shows it in groups of 4
        if "@" not in address:
            raise ConnectError("Enter the Gmail address.")
        if len(password) != 16:
            raise ConnectError("An app password has 16 letters. Create one at Google Account > Security > App passwords.")
        secret = {"email": address, "app_password": password}
        try:
            mail.check_login(_mailbox(secret))
        except RuntimeError as e:
            raise ConnectError(str(e))
        return secret, address
    if provider == "webhook":
        url = (fields.get("url") or "").strip()
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            raise ConnectError("Enter a full URL starting with https://")
        if not research.is_public_host(parsed.hostname):
            raise ConnectError("That address isn't reachable from the internet. Use a public URL (Zapier, n8n, Make).")
        result = post_webhook({"event": "flowmancer.test", "detail": "FlowMancer connection test"}, url)
        if result["status"] != "success":
            raise ConnectError(f"The webhook didn't accept the test. {result['detail']}")
        return {"url": url}, parsed.hostname
    raise ConnectError("Unknown integration", 404)


def _check_allowed(user: User):
    if user.is_demo:
        raise ConnectError("The demo account can't connect integrations. Create your own free account to connect "
                           "your Slack, HubSpot and Gmail.", 403)


def connect(db: Session, user: User, provider: str, fields: Dict[str, str]) -> dict:
    _check_allowed(user)
    if provider not in PROVIDERS:
        raise ConnectError("Unknown integration", 404)
    secret, label = _verify(provider, fields)
    row = db.query(Connection).filter(Connection.user_id == user.id, Connection.provider == provider).first()
    if row is None:
        row = Connection(user_id=user.id, provider=provider)
        db.add(row)
    row.secret, row.label = security.encrypt(secret), label[:255]
    db.commit()
    return status(db, user)[provider]


def disconnect(db: Session, user: User, provider: str) -> dict:
    _check_allowed(user)
    if provider not in PROVIDERS:
        raise ConnectError("Unknown integration", 404)
    db.query(Connection).filter(Connection.user_id == user.id, Connection.provider == provider).delete()
    db.commit()
    return status(db, user)[provider]
