"""Demo account, sample data, per-account integrations, account settings, history tools and sending."""
import imaplib

import pytest

from app.api.runs import _cell
from app.core.config import settings
from app.core.database import session_scope
from app.integrations import mail
from app.models import Connection
from app.services import demo, demo_data, limits
from tests.conftest import sign_up, wait_for

SAMPLE_RUNS = len(demo_data.RUNS)
SLACK = "https://hooks.slack.com/services/T000/B000/abcdefgh1234"
URGENT = {"from_email": "jane@customer.com", "subject": "Login broken", "body": "Can't log in!"}


def auth(account):
    return account["headers"]


@pytest.fixture
def demo_on(monkeypatch):
    monkeypatch.setattr(settings, "DEMO_ENABLED", True)


def test_demo_account_is_seeded_sandboxed_limited_and_reset(anon, demo_on, monkeypatch):
    r = anon.post("/api/auth/demo")
    assert r.status_code == 200 and r.json()["user"]["is_demo"] is True
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    assert anon.get("/api/runs/", headers=h).json()["total"] == SAMPLE_RUNS
    assert len(anon.get("/api/approvals/?status=pending", headers=h).json()) == 12
    hindi = anon.get("/api/runs/?q=पासवर्ड", headers=h).json()["items"]
    assert len(hindi) == 1 and anon.get(f"/api/runs/{hindi[0]['id']}", headers=h).json()["output"]["language"] == "Hindi"

    # Sandboxed: no settings changes, no integrations, and the email is reserved
    assert anon.patch("/api/auth/me", json={"name": "x"}, headers=h).status_code == 403
    assert anon.post("/api/auth/trigger-key/rotate", headers=h).status_code == 403
    assert anon.request("DELETE", "/api/auth/me", json={"confirm_email": settings.DEMO_EMAIL}, headers=h).status_code == 403
    assert anon.put("/api/connections/slack", json={"webhook_url": SLACK}, headers=h).status_code == 403
    assert anon.post("/api/auth/register", json={"email": settings.DEMO_EMAIL, "name": "x",
                                                 "password": "12345678"}).status_code == 409
    # The demo account never becomes the server owner, so the first real account still gets the old data
    assert anon.get("/api/integrations", headers=h).json()["can_connect"] is False

    # Daily limit: the sample data doesn't count; new runs do
    monkeypatch.setattr(settings, "DEMO_DAILY_RUN_LIMIT", 2)
    lead = {"name": "Asha", "email": "asha@acme.com"}
    for _ in range(2):
        assert anon.post("/api/use-cases/qualify-lead", json=lead, headers=h).status_code == 200
    r = anon.post("/api/use-cases/qualify-lead", json=lead, headers=h)
    assert r.status_code == 429 and "limit of 2 runs" in r.json()["detail"]

    # Nightly reset: nothing on the same day, a fresh copy on a new day
    assert demo.maybe_reset() is False
    with session_scope() as db:
        limits.set_state(db, demo.DEMO_RESET_DAY, "2000-01-01")
    assert demo.maybe_reset() is True
    assert anon.get("/api/runs/", headers=h).json()["total"] == SAMPLE_RUNS  # old token still works
    assert anon.post("/api/use-cases/qualify-lead", json=lead, headers=h).status_code == 200


def test_sample_data_search_and_csv(client):
    assert client.post("/api/sample-data").json() == {"runs": SAMPLE_RUNS}
    assert client.post("/api/sample-data").status_code == 409  # only into an empty account
    assert all(d["name"].startswith("Sample - ") for d in client.get("/api/knowledge/").json())
    assert not any(w["is_active"] for w in client.get("/api/workflows/").json())

    found = client.get("/api/runs/?q=mehta").json()
    assert found["total"] == 1 and found["items"][0]["output"]["validation_status"] == "invalid"
    assert 0 < client.get("/api/runs/?q=%25").json()["total"] < SAMPLE_RUNS  # a literal % ("GST @ 18%"), not a wildcard

    r = client.get("/api/runs/export?kind=lead")
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    lines = r.content.decode("utf-8-sig").strip().splitlines()
    assert lines[0].startswith("id,created_at,kind") and len(lines) == 1 + 6
    assert _cell("=HYPERLINK(1)") == "'=HYPERLINK(1)" and _cell(-5) == "-5"


def test_each_account_uses_its_own_integrations(anon, http_calls, monkeypatch):
    owner, other = sign_up(anon), sign_up(anon, email="b@test.com")
    bad = anon.put("/api/connections/slack", json={"webhook_url": "https://evil.example/x"}, headers=auth(other))
    assert bad.status_code == 400
    r = anon.put("/api/connections/slack", json={"webhook_url": SLACK}, headers=auth(other))
    assert r.status_code == 200 and r.json()["source"] == "account" and r.json()["label"].endswith("1234")
    assert http_calls[-1]["url"] == SLACK  # live test message
    with session_scope() as db:
        assert SLACK not in db.query(Connection).one().secret  # stored encrypted

    monkeypatch.setattr(settings, "SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/SERVER")
    assert anon.get("/api/integrations", headers=auth(owner)).json()["slack"]["source"] == "server"
    assert anon.get("/api/integrations", headers=auth(other)).json()["slack"]["source"] == "account"

    anon.post("/api/use-cases/process-email", json=URGENT, headers=auth(other))  # urgent -> Slack alert
    assert http_calls[-1]["url"] == SLACK
    anon.delete("/api/connections/slack", headers=auth(other))
    monkeypatch.setattr(settings, "SLACK_WEBHOOK_URL", "")
    assert anon.get("/api/integrations", headers=auth(other)).json()["slack"]["configured"] is False


def test_gmail_connect_checks_the_app_password(client, monkeypatch):
    class FakeIMAP:
        def __init__(self, host, port):
            pass

        def login(self, user, password):
            if password != "abcdefghijklmnop":
                raise imaplib.IMAP4.error("AUTHENTICATIONFAILED")

        def select(self, folder):
            return "OK", [b"1"]

        def logout(self):
            pass
    monkeypatch.setattr(mail.imaplib, "IMAP4_SSL", FakeIMAP)
    r = client.put("/api/connections/gmail", json={"email": "me@gmail.com", "app_password": "wrongwrongwrong1"})
    assert r.status_code == 400 and "app password" in r.json()["detail"]
    r = client.put("/api/connections/gmail", json={"email": "me@gmail.com", "app_password": "abcd efgh ijkl mnop"})
    assert r.status_code == 200 and r.json()["label"] == "me@gmail.com"
    assert client.get("/api/triggers/inbox").json()["configured"] is True


def test_send_after_approval(client, monkeypatch):
    client.post("/api/use-cases/process-email", json=URGENT)
    approval = client.get("/api/approvals/?status=pending").json()[0]
    r = client.post(f"/api/approvals/{approval['id']}/approve", json={"delivery": "send"})
    assert r.status_code == 422 and "Connect Gmail" in r.json()["detail"]  # nothing to send with yet

    sent = {}
    monkeypatch.setattr(mail, "send_email", lambda to, subject, body, in_reply_to=None, box=None:
                        sent.update(to=to, box=box) or {"status": "success", "detail": f"Sent to {to}"})
    for key, value in (("IMAP_HOST", "imap.gmail.com"), ("IMAP_USER", "me@gmail.com"), ("IMAP_PASSWORD", "pw")):
        monkeypatch.setattr(settings, key, value)
    body = client.post(f"/api/approvals/{approval['id']}/approve", json={"delivery": "send"}).json()
    assert body["status"] == "approved" and body["result"]["steps"][0]["target"] == "Gmail (sent)"
    assert sent["to"] == "jane@customer.com" and sent["box"].smtp_host == "smtp.gmail.com"


def test_daily_limit_spares_the_server_owner(anon, monkeypatch):
    monkeypatch.setattr(settings, "DAILY_RUN_LIMIT", 1)
    owner, other = sign_up(anon), sign_up(anon, email="b@test.com")
    lead = {"name": "Asha", "email": "asha@acme.com"}
    for _ in range(2):
        assert anon.post("/api/use-cases/qualify-lead", json=lead, headers=auth(owner)).status_code == 200
    assert anon.post("/api/use-cases/qualify-lead", json=lead, headers=auth(other)).status_code == 200
    r = anon.post("/api/use-cases/qualify-lead", json=lead, headers=auth(other))
    assert r.status_code == 429 and "You've reached today's limit of 1 runs" in r.json()["detail"]


def test_account_settings_and_deletion(anon, monkeypatch):
    owner, other = sign_up(anon), sign_up(anon, email="b@test.com")
    h = auth(other)
    assert anon.patch("/api/auth/me", json={"name": "Bhavna"}, headers=h).json()["name"] == "Bhavna"
    wrong = anon.post("/api/auth/password", json={"current_password": "nope", "new_password": "new-pass-123"}, headers=h)
    assert wrong.status_code == 400
    assert anon.post("/api/auth/password", json={"current_password": "correct-horse-1", "new_password": "new-pass-123"},
                     headers=h).status_code == 200
    assert anon.post("/api/auth/login", json={"email": "b@test.com", "password": "new-pass-123"}).status_code == 200

    anon.post("/api/use-cases/qualify-lead", json={"name": "Asha", "email": "asha@acme.com"}, headers=h)
    assert anon.request("DELETE", "/api/auth/me", json={"confirm_email": "x@test.com", "password": "new-pass-123"},
                        headers=h).status_code == 400
    assert anon.request("DELETE", "/api/auth/me", json={"confirm_email": "B@test.com", "password": "new-pass-123"},
                        headers=h).status_code == 204
    assert anon.get("/api/auth/me", headers=h).status_code == 401
    assert anon.get("/api/runs/", headers=auth(owner)).json()["total"] == 0

    # The server owner can't delete itself while backend/.env integrations point at it
    monkeypatch.setattr(settings, "HUBSPOT_ACCESS_TOKEN", "pat-123")
    r = anon.request("DELETE", "/api/auth/me", json={"confirm_email": "owner@test.com", "password": "correct-horse-1"},
                     headers=auth(owner))
    assert r.status_code == 409


def test_feedback_and_rerun_in_crew_mode(client):
    run = client.post("/api/use-cases/qualify-lead", json={"name": "Asha", "email": "asha@acme.com"}).json()
    r = client.post(f"/api/runs/{run['id']}/feedback", json={"field": "lead_score", "correct": "40", "note": "Tiny shop"})
    assert r.status_code == 200 and r.json()["feedback"][0]["correct"] == "40"

    new = client.post(f"/api/runs/{run['id']}/rerun?mode=crew").json()
    assert new["mode"] == "crew" and new["source"] == "rerun" and new["input_data"] == run["input_data"]
    done = wait_for(lambda: (x := client.get(f"/api/runs/{new['id']}").json())["status"] == "completed" and x)
    assert done["output"]["lead_score"] == run["output"]["lead_score"]
