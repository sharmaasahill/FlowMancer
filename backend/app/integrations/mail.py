"""
Email over IMAP and SMTP: read unread inbox messages, save reply drafts, and send approved replies.

Works with any mailbox that accepts an app password, such as Gmail (imap.gmail.com / smtp.gmail.com).
Outlook.com no longer accepts app passwords (it requires OAuth), so it isn't supported.
Each account connects its own mailbox; the server's IMAP_* settings belong to the server owner.
"""
import email
import imaplib
import smtplib
import ssl
import time
from dataclasses import dataclass
from email.message import EmailMessage
from email.policy import default as default_policy
from email.utils import parseaddr, parsedate_to_datetime
from typing import List, Optional

from app.core.config import settings
from app.services.research import html_to_text


@dataclass
class Mailbox:
    user: str
    password: str
    host: str = "imap.gmail.com"
    port: int = 993
    folder: str = "INBOX"
    drafts_folder: str = "[Gmail]/Drafts"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465


def server_mailbox() -> Optional[Mailbox]:
    """The mailbox from the server's IMAP_* settings, or None."""
    if not settings.imap_configured:
        return None
    host = settings.IMAP_HOST
    smtp_host = settings.SMTP_HOST or (("smtp." + host[5:]) if host.startswith("imap.") else host)
    return Mailbox(user=settings.IMAP_USER, password=settings.IMAP_PASSWORD, host=host, port=settings.IMAP_PORT,
                   folder=settings.IMAP_FOLDER, drafts_folder=settings.IMAP_DRAFTS_FOLDER,
                   smtp_host=smtp_host, smtp_port=settings.SMTP_PORT)


def _connect(box: Mailbox) -> imaplib.IMAP4_SSL:
    conn = imaplib.IMAP4_SSL(box.host, box.port)
    conn.login(box.user, box.password)
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


def check_login(box: Mailbox) -> None:
    """Log in and open the inbox. Raises with a readable message if that fails."""
    try:
        conn = _connect(box)
    except imaplib.IMAP4.error as e:
        raise RuntimeError("Gmail rejected the sign-in. Check the address and use a 16-character app password "
                           "(Google Account > Security > App passwords), not your normal password.") from e
    except OSError as e:
        raise RuntimeError(f"Can't reach {box.host}: {e}") from e
    try:
        status, _ = conn.select(_quote(box.folder))
        if status != "OK":
            raise RuntimeError(f"Signed in, but can't open the folder {box.folder}")
    finally:
        try:
            conn.logout()
        except Exception:
            pass


def fetch_unseen(box: Optional[Mailbox] = None, limit: Optional[int] = None) -> List[dict]:
    """Return unread messages and mark them as read. Raises on connection/login errors."""
    box = box or server_mailbox()
    if box is None:
        raise RuntimeError("No mailbox connected. Connect Gmail on the Integrations page.")
    limit = limit or settings.INBOX_MAX_PER_POLL
    conn = _connect(box)
    try:
        status, _ = conn.select(_quote(box.folder))
        if status != "OK":
            raise RuntimeError(f"Cannot open folder {box.folder}")
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


def _reply(box: Mailbox, to: str, subject: str, body: str, in_reply_to: Optional[str]) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = box.user
    msg["To"] = to
    msg["Subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to
    msg.set_content(body)
    return msg


def append_draft(to: str, subject: str, body: str, in_reply_to: Optional[str] = None,
                 box: Optional[Mailbox] = None) -> dict:
    """Save a reply as a draft in the mailbox's Drafts folder (it is NOT sent). box=None: the server mailbox."""
    box = box or server_mailbox()
    if box is None:
        return {"status": "skipped", "detail": "Gmail not connected"}
    msg = _reply(box, to, subject, body, in_reply_to)
    try:
        conn = _connect(box)
        try:
            status, detail = conn.append(_quote(box.drafts_folder), "(\\Draft)",
                                         imaplib.Time2Internaldate(time.time()), msg.as_bytes())
        finally:
            conn.logout()
        if status != "OK":
            return {"status": "error", "detail": f"IMAP append failed: {detail}"}
        return {"status": "success", "detail": f"Draft saved to {box.drafts_folder}"}
    except (imaplib.IMAP4.error, OSError) as e:
        return {"status": "error", "detail": f"IMAP error: {e}"}


def send_email(to: str, subject: str, body: str, in_reply_to: Optional[str] = None,
               box: Optional[Mailbox] = None) -> dict:
    """Send a reply over SMTP (SSL) with the mailbox's app password. box=None: the server mailbox."""
    box = box or server_mailbox()
    if box is None:
        return {"status": "skipped", "detail": "Gmail not connected"}
    msg = _reply(box, to, subject, body, in_reply_to)
    try:
        with smtplib.SMTP_SSL(box.smtp_host, box.smtp_port, context=ssl.create_default_context(), timeout=30) as smtp:
            smtp.login(box.user, box.password)
            smtp.send_message(msg)
        return {"status": "success", "detail": f"Sent to {to}"}
    except (smtplib.SMTPException, OSError) as e:
        return {"status": "error", "detail": f"Sending failed: {e}"}
