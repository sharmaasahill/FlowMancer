"""
Test setup. The AI model, crew, web research and embeddings are replaced with fast
fakes, so tests run in seconds without Ollama or network access.
"""
import hashlib
import math
import os
import tempfile
import time
from pathlib import Path

import pytest

_TMP = Path(tempfile.mkdtemp(prefix="flowmancer-tests-"))
os.environ.update({
    "DATABASE_URL": f"sqlite:///{(_TMP / 'test.db').as_posix()}",
    "KNOWLEDGE_PATH": str(_TMP / "knowledge"),
    "RESEARCH_ENABLED": "false",
    "SLACK_WEBHOOK_URL": "", "HUBSPOT_ACCESS_TOKEN": "", "WEBHOOK_URL": "",
    "IMAP_HOST": "", "IMAP_USER": "", "IMAP_PASSWORD": "", "INBOX_POLL_SECONDS": "0",
    "TRIGGER_SECRET": "", "AI_PROVIDER": "gemini", "GEMINI_API_KEY": "", "OLLAMA_FALLBACK": "false",
    "CREWAI_DISABLE_TELEMETRY": "true", "OTEL_SDK_DISABLED": "true",
})

from chromadb.api.types import EmbeddingFunction  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.results import DocumentResult, EmailResult, LeadResult  # noqa: E402
from app.services import knowledge  # noqa: E402


class HashEmbedding(EmbeddingFunction):
    """Deterministic bag-of-words embedding: texts sharing words are close."""

    def __init__(self):
        pass

    @staticmethod
    def name() -> str:
        return "flowmancer-test-hash"

    def get_config(self):
        return {}

    @staticmethod
    def build_from_config(config):
        return HashEmbedding()

    def __call__(self, input):
        vectors = []
        for text in input:
            v = [0.0] * 64
            for word in text.lower().split():
                word = "".join(c for c in word if c.isalnum())
                if word:
                    v[int(hashlib.md5(word.encode()).hexdigest(), 16) % 64] += 1.0
            norm = math.sqrt(sum(x * x for x in v)) or 1.0
            vectors.append([x / norm for x in v])
        return vectors


knowledge.embedding_function = lambda: HashEmbedding()


class FakeAI:
    """Stands in for the LLM. Tests set `responses[kind]` to control the output."""

    def __init__(self):
        self.prompts = []
        self.reset()

    def set_lead_score(self, total: int):
        """Spread `total` over the category limits (25/20/20/15/10/10)."""
        limits = {"company_size": 25, "industry_fit": 20, "budget": 20, "urgency": 15, "decision_maker": 10, "intent": 10}
        breakdown, left = {}, total
        for key, cap in limits.items():
            breakdown[key] = min(cap, left)
            left -= breakdown[key]
        self.responses["lead"]["score_breakdown"] = breakdown

    def reset(self):
        self.prompts.clear()
        self.responses = {
            "lead": dict(priority="high", recommended_action="Book a demo this week", assigned_to="Enterprise sales",
                         talking_points=["500 seats", "Budget approved"], reasoning="Large team with budget.",
                         company_summary=""),
            "email": dict(category="support", priority="urgent", sentiment="negative",
                          summary="Customer cannot log in", draft_reply="Hi, sorry about that. We're on it.",
                          action_required=True, assigned_team="Technical support", tags=["login"]),
            "document": dict(document_type="invoice", summary="Invoice from Acme", counterparty="Acme Ltd",
                             document_number="9", issue_date="2026-10-01", due_date="2026-11-01",
                             line_items=[{"description": "Widgets", "amount": 500.0}], tax_amount=None,
                             total_amount=500.0, currency="USD", fields=[], ai_notes=[],
                             next_steps=["Pay invoice"]),
        }
        self.set_lead_score(85)

    def structured_invoke(self, schema, prompt, retries=1):
        self.prompts.append(prompt)
        kind = {LeadResult: "lead", EmailResult: "email", DocumentResult: "document"}[schema]
        return schema(**self.responses[kind])


FAKE_AI = FakeAI()


def fake_run_crew(steps, tracker):
    outputs = []
    for step in steps:
        tracker.start(step.name)
        outputs.append(f"{step.name} output")
        tracker.finish(step.name, outputs[-1])
    return outputs


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    """Fresh database, empty knowledge base and fake AI for every test."""
    from app.agents import base as crew_base
    from app.core import llm

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    col = knowledge._get_collection()
    existing = col.get()["ids"]
    if existing:
        col.delete(ids=existing)

    FAKE_AI.reset()
    monkeypatch.setattr(llm, "structured_invoke", FAKE_AI.structured_invoke)
    monkeypatch.setattr(crew_base, "run_crew", fake_run_crew)
    yield


@pytest.fixture
def ai():
    return FAKE_AI


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def http_calls(monkeypatch):
    """Capture outbound httpx.post calls from integrations instead of sending them."""
    calls = []

    class Resp:
        def __init__(self, url):
            self.status_code = 200
            self.text = "ok"
            self.url = url

        def raise_for_status(self):
            pass

        def json(self):
            return {"results": [{"id": "123"}]}

    def fake_post(url, json=None, headers=None, timeout=None):
        calls.append({"url": url, "json": json, "headers": headers})
        return Resp(url)

    for module in ("app.integrations.slack", "app.integrations.hubspot", "app.integrations.webhook"):
        monkeypatch.setattr(f"{module}.httpx.post", fake_post)
    return calls


def wait_for(fn, timeout=10.0, interval=0.05):
    """Poll `fn` until it returns a truthy value."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = fn()
        if value:
            return value
        time.sleep(interval)
    raise AssertionError("Timed out waiting for condition")
