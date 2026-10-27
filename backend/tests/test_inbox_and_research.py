from email.message import EmailMessage

from app.core.config import settings
from app.integrations import mail
from app.services import research
from tests.conftest import wait_for


def make_raw(sender, subject, html=None, text=None):
    msg = EmailMessage()
    msg["From"] = sender
    msg["Subject"] = subject
    msg["Message-ID"] = "<m1@example.com>"
    msg["Date"] = "Sun, 18 Oct 2026 10:00:00 +0000"
    if text:
        msg.set_content(text)
    if html:
        if text:
            msg.add_alternative(html, subtype="html")
        else:
            msg.set_content(html, subtype="html")
    return msg.as_bytes()


class FakeIMAP:
    inbox = []
    appended = []

    def __init__(self, host, port):
        pass

    def login(self, user, password):
        return "OK", [b"logged in"]

    def select(self, folder):
        return "OK", [b"1"]

    def search(self, charset, criterion):
        return "OK", [" ".join(str(i + 1) for i in range(len(self.inbox))).encode()]

    def fetch(self, msg_id, parts):
        return "OK", [(b"1 (RFC822 {100}", self.inbox[int(msg_id) - 1]), b")"]

    def append(self, folder, flags, date, message):
        FakeIMAP.appended.append((folder, flags, message))
        return "OK", [b"APPEND completed"]

    def logout(self):
        return "BYE", []


def configure_imap(monkeypatch):
    for key, value in (("IMAP_HOST", "imap.example.com"), ("IMAP_USER", "me@example.com"), ("IMAP_PASSWORD", "pw")):
        monkeypatch.setattr(settings, key, value)
    monkeypatch.setattr(mail.imaplib, "IMAP4_SSL", FakeIMAP)


def test_parse_html_only_email():
    parsed = mail.parse_message(make_raw("Jane <jane@x.com>", "Hi", html="<p>Hello <b>there</b></p><script>x()</script>"))
    assert parsed["from_email"] == "jane@x.com"
    assert parsed["body"] == "Hello there"
    assert parsed["message_id"] == "<m1@example.com>"


def test_poll_requires_configuration(client):
    assert client.post("/api/triggers/inbox/poll").status_code == 400
    assert client.get("/api/triggers/inbox").json()["configured"] is False


def test_poll_processes_unread_emails(client, monkeypatch):
    configure_imap(monkeypatch)
    FakeIMAP.inbox = [make_raw("jane@x.com", "Login broken", text="Help me log in"),
                      make_raw("bob@y.com", "Pricing", text="How much?")]
    r = client.post("/api/triggers/inbox/poll")
    assert r.status_code == 200
    body = r.json()
    assert body["fetched"] == 2
    run_ids = [d["run_id"] for d in body["dispatched"]]

    def done():
        runs = [client.get(f"/api/runs/{i}").json() for i in run_ids]
        return runs if all(x["status"] == "completed" for x in runs) else None
    runs = wait_for(done)
    assert {x["input_data"]["subject"] for x in runs} == {"Login broken", "Pricing"}
    assert all(x["source"] == "inbox" for x in runs)
    assert client.get("/api/triggers/inbox").json()["last_count"] == 2


def test_append_draft_quotes_gmail_folder(monkeypatch):
    configure_imap(monkeypatch)
    FakeIMAP.appended = []
    result = mail.append_draft("jane@x.com", "Login broken", "We fixed it", "<m1@example.com>")
    assert result["status"] == "success"
    folder, flags, raw = FakeIMAP.appended[0]
    assert folder == '"[Gmail]/Drafts"' and flags == "(\\Draft)"
    assert b"Subject: Re: Login broken" in raw and b"In-Reply-To: <m1@example.com>" in raw


def test_company_domain():
    assert research.company_domain("john@techcorp.com") == "techcorp.com"
    assert research.company_domain("john@gmail.com") is None
    assert research.company_domain("bad") is None


def test_private_hosts_are_never_fetched():
    assert research.is_public_host("localhost") is False
    assert research.is_public_host("127.0.0.1") is False
    assert research.is_public_host("192.168.1.10") is False


def test_research_disabled_and_empty_inputs(monkeypatch):
    assert "disabled" in research.research_lead({"company": "X"}).note
    monkeypatch.setattr(settings, "RESEARCH_ENABLED", True)
    assert "No company" in research.research_lead({"email": "a@gmail.com"}).note


def test_research_combines_site_and_search(monkeypatch):
    monkeypatch.setattr(settings, "RESEARCH_ENABLED", True)
    monkeypatch.setattr(research, "fetch_website",
                        lambda d: {"title": "Acme", "url": "https://acme.com/", "snippet": "Acme makes anvils"})
    monkeypatch.setattr(research, "web_search", lambda q, n: [
        {"title": "Acme news", "url": "https://news.example/acme", "snippet": "Acme raised $10M"},
        {"title": "dup", "url": "https://acme.com/", "snippet": "dup"}])
    result = research.research_lead({"company": "Acme", "email": "a@acme.com"})
    assert [s["url"] for s in result.sources] == ["https://acme.com/", "https://news.example/acme"]
    assert "[1] Acme - https://acme.com/" in result.as_prompt()


def test_html_to_text():
    title, text = research.html_to_text("<html><title>T</title><style>.a{}</style><body><h1>Hi</h1> there</body></html>")
    assert title == "T" and text == "Hi there"
