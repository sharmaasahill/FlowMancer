"""
Email over IMAP and SMTP: read unread inbox messages, save reply drafts, and send approved replies.

Works with any mailbox that accepts an app password, such as Gmail (imap.gmail.com / smtp.gmail.com).
Outlook.com no longer accepts app passwords (it requires OAuth), so it isn't supported.
Each account connects its own mailbox; the server's IMAP_* settings belong to the server owner.

Some hosts block outgoing SMTP (Render's free plan blocks ports 25, 465 and 587). For the server
mailbox, MAIL_RELAY_URL sends through a small Google Apps Script instead (docs/mail-relay.gs), over HTTPS.
At start-up the server checks whether SMTP gets out, and only offers sending where it can work.
"""
import email
import imaplib
import logging
import smtplib
import socket
import ssl
import threading
import time
from dataclasses import dataclass
from email.message import EmailMessage
from email.policy import default as default_policy
from email.utils import parseaddr, parsedate_to_datetime
from typing import List, Optional

import httpx

from app.core.config import settings
from app.services.research import html_to_text

log = logging.getLogger("flowmancer.mail")
_smtp_ok: Optional[bool] = None  # None = not checked yet (assume it works)


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


def _re(subject: str) -> str:
    return subject if subject.lower().startswith("re:") else f"Re: {subject}"


def _reply(box: Mailbox, to: str, subject: str, body: str, in_reply_to: Optional[str]) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = box.user
    msg["To"] = to
    msg["Subject"] = _re(subject)
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


# ---------- can this server send? ----------
def relay_configured() -> bool:
    return bool(settings.MAIL_RELAY_URL and settings.MAIL_RELAY_SECRET)


def _uses_relay(box: Mailbox) -> bool:
    """The relay runs in the server's Gmail account, so it can only send as that mailbox."""
    return relay_configured() and bool(settings.IMAP_USER) and box.user.lower() == settings.IMAP_USER.lower()


def probe_smtp(host: str = "smtp.gmail.com", port: int = 465, timeout: float = 5) -> bool:
    """Can this host open an SMTP connection at all? Saves the answer for can_send()."""
    global _smtp_ok
    try:
        socket.create_connection((host, port), timeout=timeout).close()
        _smtp_ok = True
    except OSError:
        _smtp_ok = False
        log.warning("Outgoing email port %s is blocked on this host. Sending works only through MAIL_RELAY_URL.", port)
    return _smtp_ok


def start_smtp_probe():
    if settings.SMTP_PROBE:
        threading.Thread(target=probe_smtp, name="smtp-probe", daemon=True).start()


def can_send(box: Optional[Mailbox]) -> bool:
    return box is not None and (_uses_relay(box) or _smtp_ok is not False)


def can_send_notices() -> bool:
    """Can the server email people (password-reset links)? It sends from the server mailbox."""
    return relay_configured() or (server_mailbox() is not None and _smtp_ok is not False)


# ---------- sending ----------
def _relay(to: str, subject: str, text: str, html: Optional[str] = None, in_reply_to: Optional[str] = None) -> dict:
    payload = {"secret": settings.MAIL_RELAY_SECRET, "to": to, "subject": subject, "text": text,
               "html": html, "in_reply_to": in_reply_to, "name": settings.APP_NAME}
    try:
        # Apps Script answers a POST with a redirect to the result
        resp = httpx.post(settings.MAIL_RELAY_URL, json=payload, timeout=30, follow_redirects=True)
        data = resp.json()
    except (httpx.HTTPError, ValueError) as e:
        return {"status": "error", "detail": f"Mail relay error: {e}"}
    if not data.get("ok"):
        return {"status": "error", "detail": f"Mail relay error: {data.get('error') or 'unknown'}"}
    return {"status": "success", "detail": f"Sent to {to}"}


def _smtp(box: Mailbox, msg: EmailMessage, to: str) -> dict:
    try:
        with smtplib.SMTP_SSL(box.smtp_host, box.smtp_port, context=ssl.create_default_context(), timeout=30) as smtp:
            smtp.login(box.user, box.password)
            smtp.send_message(msg)
        return {"status": "success", "detail": f"Sent to {to}"}
    except (smtplib.SMTPException, OSError) as e:
        return {"status": "error", "detail": f"Sending failed: {e}"}


def send_email(to: str, subject: str, body: str, in_reply_to: Optional[str] = None,
               box: Optional[Mailbox] = None) -> dict:
    """Send a reply with the mailbox's app password (or the relay, for the server mailbox). box=None: the server's."""
    box = box or server_mailbox()
    if box is None:
        return {"status": "skipped", "detail": "Gmail not connected"}
    if _uses_relay(box):
        return _relay(to, _re(subject), body, in_reply_to=in_reply_to)
    return _smtp(box, _reply(box, to, subject, body, in_reply_to), to)


def send_notice(to: str, subject: str, text: str, html: Optional[str] = None) -> dict:
    """Email someone from the server mailbox (e.g. a password-reset link)."""
    if relay_configured():
        return _relay(to, subject, text, html)
    box = server_mailbox()
    if box is None:
        return {"status": "skipped", "detail": "No server mailbox to send from"}
    msg = EmailMessage()
    msg["From"] = f"{settings.APP_NAME} <{box.user}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    return _smtp(box, msg, to)
