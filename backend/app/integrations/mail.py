"""
Email over IMAP: read unread inbox messages and save reply drafts.

Works with any mailbox that accepts an app password over IMAP, such as Gmail
(IMAP_HOST=imap.gmail.com). Outlook.com no longer accepts app passwords for IMAP
(it requires OAuth), so it isn't supported.
"""
import email
import imaplib
import time
from email.message import EmailMessage
from email.policy import default as default_policy
from email.utils import parseaddr, parsedate_to_datetime
from typing import List, Optional

from app.core.config import settings
from app.services.research import html_to_text


def _connect() -> imaplib.IMAP4_SSL:
    conn = imaplib.IMAP4_SSL(settings.IMAP_HOST, settings.IMAP_PORT)
    conn.login(settings.IMAP_USER, settings.IMAP_PASSWORD)
    return conn


def _quote(folder: str) -> str:
    return f'"{folder}"' if any(c in folder for c in ' []') and not folder.startswith('"') else folder


def _body_text(msg) -> str:
    part = msg.get_body(preferencelist=("plain", "html"))
    if part is None:
        return ""
    content = part.get_content()
    if part.get_content_type() == "text/html":
        content = html_to_text(content)[1]
    return content.strip()


def parse_message(raw: bytes) -> dict:
    msg = email.message_from_bytes(raw, policy=default_policy)
    received = None
    if msg["Date"]:
        try:
            received = parsedate_to_datetime(msg["Date"]).isoformat()
        except (TypeError, ValueError):
            received = None
    return {
        "from_email": parseaddr(msg.get("From", ""))[1] or msg.get("From", ""),
        "subject": str(msg.get("Subject", "")),
        "body": _body_text(msg)[:50000] or "(empty)",
        "message_id": msg.get("Message-ID"),
        "received_at": received,
        "attachments": [p.get_filename() for p in msg.iter_attachments() if p.get_filename()],
    }


def fetch_unseen(limit: Optional[int] = None) -> List[dict]:
    """Return unread messages and mark them as read. Raises on connection/login errors."""
    if not settings.imap_configured:
        raise RuntimeError("Inbox not configured: set IMAP_HOST, IMAP_USER and IMAP_PASSWORD")
    limit = limit or settings.INBOX_MAX_PER_POLL
    conn = _connect()
    try:
        status, _ = conn.select(_quote(settings.IMAP_FOLDER))
        if status != "OK":
            raise RuntimeError(f"Cannot open folder {settings.IMAP_FOLDER}")
        status, data = conn.search(None, "UNSEEN")
        ids = data[0].split()[:limit] if status == "OK" and data and data[0] else []
        messages = []
        for msg_id in ids:
            status, parts = conn.fetch(msg_id, "(RFC822)")  # fetching RFC822 marks the message \Seen
            if status != "OK":
                continue
            raw = next((p[1] for p in parts if isinstance(p, tuple)), None)
            if raw:
                messages.append(parse_message(raw))
        return messages
    finally:
        try:
            conn.logout()
        except Exception:
            pass


def append_draft(to: str, subject: str, body: str, in_reply_to: Optional[str] = None) -> dict:
    """Save a reply as a draft in the mailbox's Drafts folder (it is NOT sent)."""
    if not settings.imap_configured:
        return {"status": "skipped", "detail": "Mailbox not configured (IMAP_* settings)"}
    msg = EmailMessage()
    msg["From"] = settings.IMAP_USER
    msg["To"] = to
    msg["Subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to
    msg.set_content(body)
    try:
        conn = _connect()
        try:
            status, detail = conn.append(
                _quote(settings.IMAP_DRAFTS_FOLDER),
                "(\\Draft)",
                imaplib.Time2Internaldate(time.time()),
                msg.as_bytes(),
            )
        finally:
            conn.logout()
        if status != "OK":
            return {"status": "error", "detail": f"IMAP append failed: {detail}"}
        return {"status": "success", "detail": f"Draft saved to {settings.IMAP_DRAFTS_FOLDER}"}
    except (imaplib.IMAP4.error, OSError) as e:
        return {"status": "error", "detail": f"IMAP error: {e}"}
