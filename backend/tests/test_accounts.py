import pytest

from app.core import security
from app.core.config import settings
from app.core.database import session_scope
from app.models import Run, Workflow
from tests.conftest import sign_up

LEAD = {"name": "John Doe", "email": "john@techcorp.com", "company": "Tech Corp"}


def test_password_hashing():
    stored = security.hash_password("s3cret-pass")
    assert stored.startswith("scrypt$") and "s3cret-pass" not in stored
    assert security.verify_password("s3cret-pass", stored)
    assert not security.verify_password("wrong", stored)
    assert not security.verify_password("x", "garbage")
    assert security.hash_password("same") != security.hash_password("same")  # salted


def test_tokens():
    token = security.create_token(42)
    assert security.decode_token(token) == 42
    assert security.decode_token(token + "x") is None
    assert security.decode_token("not-a-token") is None


def test_everything_requires_sign_in(anon):
    for path in ("/api/runs/", "/api/approvals/", "/api/workflows/", "/api/knowledge/", "/api/stats",
                 "/api/integrations", "/api/auth/me", "/api/triggers/inbox"):
        assert anon.get(path).status_code == 401, path
    assert anon.post("/api/use-cases/qualify-lead", json=LEAD).status_code == 401
    assert anon.get("/api/runs/", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    assert anon.get("/health").status_code == 200  # public


def test_register_login_and_me(anon):
    account = sign_up(anon, email="Priya@Example.com", name="Priya")
    assert account["user"]["email"] == "priya@example.com"  # normalized
    assert account["user"]["trigger_key"].startswith("fmk_")

    r = anon.post("/api/auth/login", json={"email": "priya@example.com", "password": "correct-horse-1"})
    assert r.status_code == 200
    me = anon.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['token']}"}).json()
    assert me["name"] == "Priya"
    assert "password_hash" not in me


def test_register_validation(anon):
    sign_up(anon, email="a@example.com")
    dup = anon.post("/api/auth/register", json={"email": "A@example.com", "name": "x", "password": "long-enough-1"})
    assert dup.status_code == 409
    short = anon.post("/api/auth/register", json={"email": "b@example.com", "name": "x", "password": "short"})
    assert short.status_code == 422
    bad = anon.post("/api/auth/register", json={"email": "not-an-email", "name": "x", "password": "long-enough-1"})
    assert bad.status_code == 422


def test_wrong_password_and_throttling(anon):
    sign_up(anon, email="t@example.com")
    for _ in range(8):
        assert anon.post("/api/auth/login", json={"email": "t@example.com", "password": "nope"}).status_code == 401
    r = anon.post("/api/auth/login", json={"email": "t@example.com", "password": "correct-horse-1"})
    assert r.status_code == 429  # locked out even with the right password


def test_signups_can_be_closed(anon, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_SIGNUPS", False)
    assert anon.get("/api/auth/config").json() == {"signups_open": True, "has_users": False, "google_client_id": None}
    sign_up(anon, email="first@example.com")  # the first account is always allowed
    r = anon.post("/api/auth/register", json={"email": "second@example.com", "name": "x", "password": "long-enough-1"})
    assert r.status_code == 403
    assert anon.get("/api/auth/config").json()["signups_open"] is False


def test_first_account_claims_existing_data(anon):
    with session_scope() as db:
        db.add(Run(kind="lead", mode="quick", status="completed", source="api", input_data=LEAD))
        db.add(Workflow(name="Old flow"))
        db.commit()
    first = sign_up(anon, email="first@example.com")
    second = sign_up(anon, email="second@example.com")
    assert anon.get("/api/runs/", headers=first["headers"]).json()["total"] == 1
    assert len(anon.get("/api/workflows/", headers=first["headers"]).json()) == 1
    assert anon.get("/api/runs/", headers=second["headers"]).json()["total"] == 0


def test_users_cannot_see_each_others_data(client, anon):
    run = client.post("/api/use-cases/qualify-lead", json=LEAD).json()
    doc = client.post("/api/knowledge/text", json={"name": "Refunds", "text": "Refunds within 30 days."}).json()
    wf = client.post("/api/workflows/", json={"name": "Mine"}).json()
    approval = client.get("/api/approvals/?status=pending").json()[0]

    other = sign_up(anon, email="other@example.com")["headers"]
    assert anon.get("/api/runs/", headers=other).json()["total"] == 0
    assert anon.get(f"/api/runs/{run['id']}", headers=other).status_code == 404
    assert anon.get(f"/api/runs/{run['id']}/events", headers=other).status_code == 404
    assert anon.get("/api/approvals/", headers=other).json() == []
    assert anon.post(f"/api/approvals/{approval['id']}/approve", json={}, headers=other).status_code == 404
    assert anon.get("/api/knowledge/", headers=other).json() == []
    assert anon.delete(f"/api/knowledge/{doc['id']}", headers=other).status_code == 404
    assert anon.get("/api/knowledge/search", params={"q": "refunds"}, headers=other).json()["results"] == []
    assert anon.get(f"/api/workflows/{wf['id']}", headers=other).status_code == 404
    assert anon.get("/api/stats", headers=other).json()["totals"]["runs"] == 0

    # and the owner still sees everything
    assert client.get("/api/stats").json()["totals"]["runs"] == 1


def test_knowledge_is_private_to_each_account(client, anon, ai):
    client.post("/api/knowledge/text", json={"name": "Refunds", "text": "Full refund within 30 days of purchase."})
    other = sign_up(anon, email="other@example.com")["headers"]
    email = {"from_email": "c@x.com", "subject": "Refund request", "body": "Can I get a full refund? purchase 10 days ago"}
    run = anon.post("/api/use-cases/process-email", json=email, headers=other).json()
    assert run["knowledge"] == []  # the other account's AI never sees the owner's policy
    mine = client.post("/api/use-cases/process-email", json=email).json()
    assert mine["knowledge"] and mine["knowledge"][0]["doc_name"] == "Refunds"


@pytest.mark.parametrize("owner_email,expected", [("", "first@example.com"), ("second@example.com", "second@example.com")])
def test_inbox_owner(anon, monkeypatch, owner_email, expected):
    monkeypatch.setattr(settings, "INBOX_OWNER_EMAIL", owner_email)
    sign_up(anon, email="first@example.com")
    sign_up(anon, email="second@example.com")
    from app.services import accounts
    with session_scope() as db:
        assert accounts.inbox_owner(db).email == expected


# ---------------- Sign in with Google ----------------
GOOGLE_CLAIMS = {"iss": "https://accounts.google.com", "sub": "1098765", "email": "Asha@Gmail.com",
                 "email_verified": True, "name": "Asha Rao"}


@pytest.fixture
def google(monkeypatch):
    """Google sign-in enabled, with token checks replaced by `google.claims` (or `google.error`)."""
    class Fake:
        claims = dict(GOOGLE_CLAIMS)
        error = None

    def verify(credential):
        if Fake.error:
            raise security.GoogleTokenError(Fake.error)
        return dict(Fake.claims)

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "123-abc.apps.googleusercontent.com")
    monkeypatch.setattr(security, "verify_google_token", verify)
    return Fake


def google_login(c, **kw):
    return c.post("/api/auth/google", json={"credential": "x" * 40}, **kw)


def test_google_client_id_is_published(anon, google):
    assert anon.get("/api/auth/config").json()["google_client_id"] == "123-abc.apps.googleusercontent.com"


def test_google_sign_up_then_sign_in(anon, google):
    r = google_login(anon)
    assert r.status_code == 200, r.text
    user = r.json()["user"]
    assert user["email"] == "asha@gmail.com" and user["name"] == "Asha Rao"
    assert user["google_linked"] is True and user["has_password"] is False
    me = anon.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['token']}"})
    assert me.json()["id"] == user["id"]

    assert google_login(anon).json()["user"]["id"] == user["id"]  # same account next time
    # No password exists, so password sign-in explains what to do
    r = anon.post("/api/auth/login", json={"email": "asha@gmail.com", "password": "anything"})
    assert r.status_code == 401 and "Google" in r.json()["detail"]


def test_google_links_an_existing_account_with_the_same_email(anon, google):
    existing = sign_up(anon, email="asha@gmail.com", name="Asha")
    r = google_login(anon)
    assert r.json()["user"]["id"] == existing["user"]["id"]
    assert r.json()["user"]["google_linked"] and r.json()["user"]["has_password"]
    # The password still works too
    assert anon.post("/api/auth/login", json={"email": "asha@gmail.com", "password": "correct-horse-1"}).status_code == 200


def test_google_rejects_unverified_email(anon, google):
    google.claims = {**GOOGLE_CLAIMS, "email_verified": False}
    assert google_login(anon).status_code == 403


def test_google_rejects_bad_tokens(anon, google):
    google.error = "Google sign-in failed: Token expired"
    r = google_login(anon)
    assert r.status_code == 401 and "expired" in r.json()["detail"]


def test_google_email_taken_by_another_google_account(anon, google):
    google_login(anon)
    google.claims = {**GOOGLE_CLAIMS, "sub": "different-person"}
    assert google_login(anon).status_code == 409


def test_google_respects_closed_signups(anon, google, monkeypatch):
    sign_up(anon, email="first@example.com")
    monkeypatch.setattr(settings, "ALLOW_SIGNUPS", False)
    assert google_login(anon).status_code == 403


def test_first_google_account_claims_existing_data(anon, google):
    with session_scope() as db:
        db.add(Run(kind="lead", mode="quick", status="completed", source="api", input_data=LEAD))
        db.commit()
    headers = {"Authorization": f"Bearer {google_login(anon).json()['token']}"}
    assert anon.get("/api/runs/", headers=headers).json()["total"] == 1


def test_google_sign_in_off_when_not_configured(anon):
    r = google_login(anon)  # real verifier, no client ID set
    assert r.status_code == 401 and "not set up" in r.json()["detail"]
