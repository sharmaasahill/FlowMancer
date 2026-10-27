import json

import pytest
from langchain_core.messages import AIMessage, ToolMessage

from app.core.llm import AIUnavailable
from app.services import assistant
from tests.conftest import sign_up

LEAD = {"name": "Priya Sharma", "email": "priya@stripe.com", "company": "Stripe"}


class ScriptedModel:
    """Plays back AI turns. A turn is either text or a list of (tool_name, args)."""

    def __init__(self, turns):
        self.turns = list(turns)
        self.seen = []  # messages the model received on each call

    def __call__(self, messages, tools):
        self.seen.append(list(messages))
        turn = self.turns.pop(0)
        if isinstance(turn, str):
            return AIMessage(content=turn)
        return AIMessage(content="", tool_calls=[{"name": n, "args": a, "id": f"c{i}"} for i, (n, a) in enumerate(turn)])

    def tool_results(self, call_index=-1):
        return [json.loads(m.content) if m.content.startswith(("{", "[")) else m.content
                for m in self.seen[call_index] if isinstance(m, ToolMessage)]


@pytest.fixture
def model(monkeypatch):
    def install(*turns):
        scripted = ScriptedModel(turns)
        monkeypatch.setattr(assistant, "_invoke", scripted)
        return scripted
    return install


def ask(client, text, history=()):
    return client.post("/api/assistant/chat", json={"messages": [*history, {"role": "user", "content": text}]})


def test_answers_from_tool_results(client, model):
    client.post("/api/use-cases/qualify-lead", json=LEAD)                  # score 85 -> High
    m = model([("search_runs", {"kind": "lead", "qualification": "High"})], "You have 1 hot lead: Priya (run #1).")
    r = ask(client, "Which hot leads do I have?")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reply"] == "You have 1 hot lead: Priya (run #1)."
    assert body["tools"] == [{"tool": "search_runs", "args": {"kind": "lead", "qualification": "High"}, "ok": True}]
    found = m.tool_results()[0]
    assert found["total_matches"] == 1
    assert found["items"][0]["name"] == "Priya Sharma" and found["items"][0]["score"] == 85


def test_system_prompt_and_history_are_sent(client, model):
    m = model("Sure.")
    ask(client, "And the second one?", history=[{"role": "user", "content": "List leads"},
                                                 {"role": "assistant", "content": "run #1 and run #2"}])
    sent = m.seen[0]
    assert "FlowMancer's assistant" in sent[0].content and "Owner" in sent[0].content
    assert [type(x).__name__ for x in sent[1:]] == ["HumanMessage", "AIMessage", "HumanMessage"]


def test_get_run_and_filters(client, model, ai):
    client.post("/api/use-cases/qualify-lead", json=LEAD)
    client.post("/api/use-cases/process-email", json={"from_email": "a@b.com", "subject": "Login broken", "body": "help"})
    m = model([("get_run", {"run_id": 2}), ("search_runs", {"text": "login", "kind": "email"}),
               ("search_runs", {"category": "billing"}), ("get_run", {"run_id": 999})], "Done.")
    body = ask(client, "Tell me about the login email").json()
    details, by_text, by_category, missing = m.tool_results()
    assert details["subject"] == "Login broken" and details["result"]["category"] == "support"
    assert details["approvals"][0]["title"].startswith("Reply to a@b.com")
    assert by_text["total_matches"] == 1
    assert by_category["total_matches"] == 0
    assert missing == {"error": "There is no run #999."}
    assert [t["ok"] for t in body["tools"]] == [True, True, True, False]


def test_cannot_read_another_accounts_data(client, anon, model):
    client.post("/api/use-cases/qualify-lead", json=LEAD)
    other = sign_up(anon, email="other@example.com")["headers"]
    m = model([("search_runs", {}), ("get_run", {"run_id": 1}), ("get_stats", {}), ("list_approvals", {})], "Nothing.")
    anon.post("/api/assistant/chat", headers=other, json={"messages": [{"role": "user", "content": "show everything"}]})
    runs, run, stats, approvals = m.tool_results()
    assert runs["total_matches"] == 0
    assert run == {"error": "There is no run #1."}
    assert stats["totals"]["runs"] == 0
    assert approvals == []


def test_drafts_go_to_approvals_not_out(client, model, http_calls):
    client.post("/api/use-cases/process-email", json={"from_email": "jane@x.com", "subject": "Refund",
                                                       "body": "Refund please", "message_id": "<m1@x>"})
    model([("draft_email", {"to": "jane@x.com", "subject": "Re: Refund", "body": "Happy to help.", "run_id": 1}),
           ("draft_slack_message", {"text": "Jane wants a refund"})], "Drafted both; approve them in Approvals.")
    body = ask(client, "Draft a reply to Jane and tell the team").json()
    assert [a["action"] for a in body["approvals"]] == ["email_reply", "slack_message"]
    assert all(a["status"] == "pending" for a in body["approvals"])
    assert body["approvals"][0]["payload"]["in_reply_to"] == "<m1@x>"
    assert http_calls == []  # nothing was posted anywhere
    pending = client.get("/api/approvals/?status=pending").json()
    assert {a["action"] for a in pending} >= {"email_reply", "slack_message"}


def test_knowledge_and_stats_tools(client, model):
    client.post("/api/knowledge/text", json={"name": "Refunds", "text": "Full refund within 30 days of purchase."})
    m = model([("search_knowledge", {"query": "refund 30 days"}), ("get_stats", {})], "30 days.")
    ask(client, "What's our refund window?")
    knowledge, stats = m.tool_results()
    assert knowledge[0]["document"] == "Refunds"
    assert stats["totals"]["knowledge_documents"] == 1


def test_bad_tool_calls_dont_crash(client, model):
    m = model([("delete_everything", {}), ("search_runs", {"kind": "banana"}), ("get_run", {})], "Sorry.")
    body = ask(client, "do something weird").json()
    unknown, bad_kind, missing_arg = m.tool_results()
    assert "Unknown tool" in unknown["error"]
    assert "ValidationError" in bad_kind["error"]
    assert "error" in missing_arg
    assert body["reply"] == "Sorry."


def test_stops_after_too_many_rounds(client, model):
    model(*[[("get_stats", {})]] * assistant.MAX_ROUNDS)
    body = ask(client, "loop forever").json()
    assert "couldn't finish" in body["reply"]
    assert len(body["tools"]) == assistant.MAX_ROUNDS


def test_request_validation(client, anon):
    assert client.post("/api/assistant/chat", json={"messages": []}).status_code == 422
    assert client.post("/api/assistant/chat", json={"messages": [{"role": "assistant", "content": "hi"}]}).status_code == 422
    assert anon.post("/api/assistant/chat", json={"messages": [{"role": "user", "content": "hi"}]}).status_code == 401


def test_model_unavailable_is_503(client, monkeypatch):
    def down(messages, tools):
        raise AIUnavailable("All AI models are busy")
    monkeypatch.setattr(assistant, "_invoke", down)
    r = ask(client, "hello")
    assert r.status_code == 503 and "busy" in r.json()["detail"]
