"""AI usage tracking and the Usage page API."""
import pytest

from app.core import llm
from app.core.database import session_scope
from app.models import AICall
from app.services import knowledge, usage
from tests.conftest import FAKE_AI, sign_up

MAIN = llm.Target("gemini", "gemini-3.5-flash-lite")
BACKUP = llm.Target("gemini", "gemini-3.1-flash-lite")
LEAD = {"name": "Priya", "email": "priya@stripe.com", "company": "Stripe", "message": "300 seats, budget approved."}


@pytest.fixture
def chain(monkeypatch):
    monkeypatch.setattr(llm, "targets", lambda: [MAIN, BACKUP])


def metered_structured_invoke(schema, prompt, retries=1):
    """Like the real structured_invoke, but answers with the fake AI and reports tokens."""
    def call(target):
        llm.note_tokens(1000, 200)
        return FAKE_AI.structured_invoke(schema, prompt)
    return llm.with_fallback(call)


def calls():
    with session_scope() as db:
        return [(c.feature, c.model, c.status, c.fallback, c.input_tokens, c.output_tokens, c.user_id)
                for c in db.query(AICall).order_by(AICall.id)]


def test_fallback_attempts_are_recorded(client, chain):
    def call(target):
        if target is MAIN:
            raise RuntimeError("503 UNAVAILABLE: high demand")
        llm.note_tokens(1000, 200)
        return "ok"

    with usage.scope(client.user["id"], "email", mode="quick"):
        assert llm.with_fallback(call) == "ok"

    uid = client.user["id"]
    assert calls() == [("email", MAIN.model, "busy", False, 0, 0, uid),
                       ("email", BACKUP.model, "ok", True, 1000, 200, uid)]
    totals = client.get("/api/usage").json()["totals"]
    assert totals["calls"] == 2 and totals["failed"] == 1 and totals["fallbacks"] == 1
    # 1000 input at $0.25/M + 200 output at $1.50/M on the backup model; the failed call costs nothing
    assert totals["cost_usd"] == pytest.approx(0.00055)


def test_real_errors_are_recorded_and_raised(client, chain):
    def call(target):
        raise RuntimeError("400 API key not valid")

    with usage.scope(client.user["id"], "lead"):
        with pytest.raises(RuntimeError):
            llm.with_fallback(call)
    assert [c[2] for c in calls()] == ["error"]  # no fallback for a bad key


def test_rate_limits_are_labelled(client, chain):
    def call(target):
        raise RuntimeError("429 RESOURCE_EXHAUSTED quota")

    with usage.scope(client.user["id"], "lead"):
        with pytest.raises(llm.AIUnavailable):
            llm.with_fallback(call)
    assert [c[2] for c in calls()] == ["rate_limited", "rate_limited"]


def test_calls_outside_a_scope_are_not_stored(client, chain):
    llm.with_fallback(lambda t: "ok")
    assert calls() == []


def test_runs_are_attributed_to_their_feature(client, chain, monkeypatch):
    monkeypatch.setattr(llm, "structured_invoke", metered_structured_invoke)
    run = client.post("/api/use-cases/qualify-lead", json=LEAD).json()

    data = client.get("/api/usage?days=7").json()
    lead = next(f for f in data["by_feature"] if f["feature"] == "lead")
    assert lead["items"] == 1 and lead["input_tokens"] == 1000 and lead["output_tokens"] == 200
    assert lead["tokens_per_item"] == 1200
    assert lead["cost_per_item_usd"] == pytest.approx(0.0008)  # $0.30/M in, $2.50/M out
    assert data["recent"][0]["run_id"] == run["id"]
    assert data["by_model"][0]["model"] == MAIN.model and data["by_model"][0]["price_per_million"] == [0.30, 2.50]
    assert data["daily"][-1]["requests"] == 1 and len(data["daily"]) == 7
    assert data["today"]["requests"] == 1


def test_usage_is_private_to_each_account(client, chain, monkeypatch):
    monkeypatch.setattr(llm, "structured_invoke", metered_structured_invoke)
    client.post("/api/use-cases/qualify-lead", json=LEAD)
    other = sign_up(client, email="other@test.com")
    data = client.get("/api/usage", headers=other["headers"]).json()
    assert data["totals"]["calls"] == 0 and data["recent"] == []


def test_unknown_models_show_tokens_without_cost(client, monkeypatch):
    monkeypatch.setattr(llm, "targets", lambda: [llm.Target("gemini", "some-new-model")])
    with usage.scope(client.user["id"], "assistant"):
        llm.with_fallback(lambda t: llm.note_tokens(10, 5))
    data = client.get("/api/usage").json()
    assert data["totals"]["unpriced_calls"] == 1 and data["totals"]["cost_usd"] == 0
    assert data["recent"][0]["cost_usd"] is None


def test_local_models_are_free():
    assert usage.cost_of("ollama", "llama3.2", 10_000, 10_000) == 0


def test_usage_requires_sign_in(anon):
    assert anon.get("/api/usage").status_code == 401


def test_days_are_bounded(client):
    assert client.get("/api/usage?days=0").status_code == 422
    assert client.get("/api/usage?days=91").status_code == 422
    assert len(client.get("/api/usage?days=30").json()["daily"]) == 30


def test_knowledge_is_rebuilt_from_the_database(client):
    doc = client.post("/api/knowledge/text", json={"name": "Refunds", "text": "Refunds are issued within 14 days."}).json()
    knowledge.delete_document(doc["id"])  # simulate a host that wiped the vector store
    assert client.get("/api/knowledge/search", params={"q": "refunds issued"}).json()["results"] == []

    assert knowledge.rebuild_missing() == 1
    hits = client.get("/api/knowledge/search", params={"q": "refunds issued"}).json()["results"]
    assert hits and hits[0]["doc_name"] == "Refunds"
    assert knowledge.rebuild_missing() == 0  # nothing missing now
