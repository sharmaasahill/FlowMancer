import json

from app.services import research as research_mod
from tests.conftest import wait_for

LEAD = {"name": "John Doe", "email": "john@techcorp.com", "company": "Tech Corp",
        "message": "Need enterprise plan for 500 users, budget approved"}


def test_health(client):
    assert client.get("/health").json()["status"] == "healthy"


def test_quick_lead_returns_structured_result(client, ai):
    r = client.post("/api/use-cases/qualify-lead", json=LEAD)
    assert r.status_code == 200
    run = r.json()
    assert run["status"] == "completed"
    assert run["kind"] == "lead" and run["mode"] == "quick"
    # The score is the sum of the category points, computed in code
    assert run["output"]["lead_score"] == 85
    assert run["output"]["qualification"] == "High"
    assert run["output"]["score_breakdown"]["company_size"] == 25
    assert [s["name"] for s in run["steps"]] == ["Research", "Knowledge lookup", "Analyze"]
    assert run["steps"][-1]["status"] == "completed"


def test_invalid_mode_and_email_rejected(client):
    assert client.post("/api/use-cases/qualify-lead?mode=xyz", json=LEAD).status_code == 422
    assert client.post("/api/use-cases/qualify-lead", json={**LEAD, "email": "not-an-email"}).status_code == 422


def test_research_sources_are_stored_and_sent_to_model(client, ai, monkeypatch):
    monkeypatch.setattr(research_mod, "research_lead", lambda lead: research_mod.ResearchResult(
        sources=[{"title": "Tech Corp", "url": "https://techcorp.example/", "snippet": "We build robots."}]))
    run = client.post("/api/use-cases/qualify-lead", json=LEAD).json()
    assert run["research"][0]["url"] == "https://techcorp.example/"
    assert run["steps"][0]["status"] == "completed"
    assert "We build robots." in ai.prompts[-1]


def test_crew_mode_records_every_agent_step(client):
    run = client.post("/api/use-cases/process-email?mode=crew",
                      json={"from_email": "a@b.com", "subject": "Help", "body": "Broken"}).json()
    assert run["status"] == "completed"
    names = [s["name"] for s in run["steps"]]
    assert names == ["Knowledge lookup", "Email Classifier", "Sentiment Analyzer",
                     "Response Drafter", "Action Coordinator", "Structure results"]
    assert all(s["status"] in ("completed", "skipped") for s in run["steps"])
    assert "Response Drafter output" in run["raw_text"]


def test_failed_model_marks_run_failed(client, ai, monkeypatch):
    from app.core import llm

    def boom(*a, **k):
        raise RuntimeError("Ollama is not running")
    monkeypatch.setattr(llm, "structured_invoke", boom)
    run = client.post("/api/use-cases/qualify-lead", json=LEAD).json()
    assert run["status"] == "failed"
    assert "Ollama is not running" in run["error"]
    assert any(s["status"] == "failed" for s in run["steps"])


def test_background_job_and_live_events(client):
    r = client.post("/api/use-cases/jobs/lead?mode=crew", json=LEAD)
    assert r.status_code == 202
    run_id = r.json()["id"]

    wait_for(lambda: client.get(f"/api/runs/{run_id}").json()["status"] == "completed")

    with client.stream("GET", f"/api/runs/{run_id}/events") as stream:
        body = "".join(stream.iter_text())
    events = [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: {\"")]
    assert events and events[-1]["status"] == "completed"
    assert "event: done" in body


def test_job_rejects_bad_payload(client):
    assert client.post("/api/use-cases/jobs/lead", json={"name": "x"}).status_code == 422


def test_document_upload(client):
    files = {"file": ("invoice.txt", b"Invoice #9 from Acme Ltd. Total 500 USD", "text/plain")}
    r = client.post("/api/use-cases/process-document/upload", files=files, data={"mode": "quick"})
    assert r.status_code == 202
    run_id = r.json()["id"]
    run = wait_for(lambda: (lambda d: d if d["status"] == "completed" else None)(client.get(f"/api/runs/{run_id}").json()))
    assert run["source"] == "upload"
    assert run["input_data"]["file_name"] == "invoice.txt"
    assert "Acme" in run["input_data"]["file_content"]


def test_upload_rejects_unsupported_type(client):
    files = {"file": ("photo.jpg", b"\xff\xd8\xff", "image/jpeg")}
    r = client.post("/api/use-cases/process-document/upload", files=files)
    assert r.status_code == 422
    assert "Unsupported" in r.json()["detail"]


def test_run_history_filters(client):
    client.post("/api/use-cases/qualify-lead", json=LEAD)
    client.post("/api/use-cases/process-email", json={"from_email": "a@b.com", "subject": "s", "body": "b"})
    all_runs = client.get("/api/runs/").json()
    assert all_runs["total"] == 2
    leads = client.get("/api/runs/?kind=lead").json()
    assert leads["total"] == 1 and leads["items"][0]["kind"] == "lead"
