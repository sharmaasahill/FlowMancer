from app.core.config import settings
from tests.conftest import wait_for

LEAD = {"name": "John Doe", "email": "john@techcorp.com", "company": "Tech Corp", "message": "500 users"}


def node(id, type, **data):
    return {"id": id, "type": type, "position": {"x": 0, "y": 0}, "data": data}


def edge(source, target, handle=None):
    e = {"id": f"{source}-{target}", "source": source, "target": target}
    if handle:
        e["sourceHandle"] = handle
    return e


def hot_lead_graph(trigger="manual"):
    return {
        "nodes": [
            node("t", "trigger", trigger=trigger),
            node("ai", "ai", task="lead", mode="quick"),
            node("c", "condition", field="lead_score", operator="gte", value="80"),
            node("slack", "action", action="slack", text="Hot: {input.name} scored {result.lead_score}"),
            node("appr", "action", action="approval", approval_action="crm_contact"),
            node("hook", "action", action="webhook", url="https://hooks.example.com/x"),
        ],
        "edges": [edge("t", "ai"), edge("ai", "c"), edge("c", "slack", "true"), edge("slack", "appr"),
                  edge("c", "hook", "false")],
    }


def create(client, graph, **extra):
    r = client.post("/api/workflows/", json={"name": "Hot leads", "config": graph, **extra})
    assert r.status_code == 201, r.text
    return r.json()


def finished(client, ex_id):
    def check():
        ex = client.get(f"/api/executions/{ex_id}").json()
        return ex if ex["status"] in ("completed", "failed") else None
    return wait_for(check)


def test_validation_rejects_bad_graphs(client):
    two_triggers = {"nodes": [node("a", "trigger", trigger="manual"), node("b", "trigger", trigger="form")], "edges": []}
    r = client.post("/api/workflows/", json={"name": "x", "config": two_triggers})
    assert r.status_code == 422 and "exactly one trigger" in str(r.json())

    loop = {"nodes": [node("t", "trigger", trigger="manual"), node("a", "ai", task="lead"), node("b", "ai", task="lead")],
            "edges": [edge("t", "a"), edge("a", "b"), edge("b", "a")]}
    assert "loop" in str(client.post("/api/workflows/", json={"name": "x", "config": loop}).json())

    bad_cond = {"nodes": [node("t", "trigger", trigger="manual"), node("c", "condition", field="x", operator="eq"),
                          node("s", "action", action="slack")],
                "edges": [edge("t", "c"), edge("c", "s")]}
    assert "true' or 'false" in str(client.post("/api/workflows/", json={"name": "x", "config": bad_cond}).json())


def test_true_branch_posts_slack_and_creates_approval(client, http_calls, monkeypatch):
    monkeypatch.setattr(settings, "SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T/B/X")
    wf = create(client, hot_lead_graph())
    ex = client.post(f"/api/workflows/{wf['id']}/run", json={"input_data": LEAD})
    assert ex.status_code == 202
    ex = finished(client, ex.json()["id"])

    assert ex["status"] == "completed", ex
    labels = [(l["type"], l["status"]) for l in ex["agent_logs"]]
    assert labels == [("trigger", "completed"), ("ai", "completed"), ("condition", "completed"),
                      ("action", "completed"), ("action", "completed")]
    assert http_calls[0]["json"]["text"] == "Hot: John Doe scored 85"
    assert not any("hooks.example.com" in c["url"] for c in http_calls)  # false branch skipped

    approvals = client.get("/api/approvals/?status=pending").json()
    assert len(approvals) == 1 and approvals[0]["workflow_execution_id"] == ex["id"]
    assert ex["output_data"]["result"]["lead_score"] == 85


def test_false_branch_calls_webhook(client, ai, http_calls):
    ai.set_lead_score(30)
    wf = create(client, hot_lead_graph())
    ex = finished(client, client.post(f"/api/workflows/{wf['id']}/run", json={"input_data": LEAD}).json()["id"])
    assert ex["status"] == "completed"
    assert http_calls[0]["url"] == "https://hooks.example.com/x"
    assert http_calls[0]["json"]["result"]["lead_score"] == 30
    # Workflow runs don't add the default approvals
    assert client.get("/api/approvals/?status=pending").json() == []


def test_bad_input_fails_with_clear_error(client):
    wf = create(client, hot_lead_graph())
    ex = finished(client, client.post(f"/api/workflows/{wf['id']}/run", json={"input_data": {"foo": 1}}).json()["id"])
    assert ex["status"] == "failed"
    assert "doesn't fit a lead" in ex["error_message"]


def test_inactive_and_empty_workflows_cannot_run(client):
    wf = create(client, hot_lead_graph(), is_active=False)
    assert client.post(f"/api/workflows/{wf['id']}/run", json={"input_data": LEAD}).status_code == 422
    empty = client.post("/api/workflows/", json={"name": "empty"}).json()
    r = client.post(f"/api/workflows/{empty['id']}/run", json={"input_data": LEAD})
    assert r.status_code == 422 and "no steps" in r.json()["detail"]


def test_form_trigger_routes_to_form_workflow(client):
    wf = create(client, hot_lead_graph(trigger="form"))
    r = client.post(f"/api/triggers/form?key={client.user['trigger_key']}", data={"your-name": "Ann Lee", "Email": "ann@corp.io",
                                                 "company_name": "Corp", "comments": "Pricing?", "budget": "50k"})
    assert r.status_code == 202, r.text
    ex = finished(client, r.json()["workflow_execution_ids"][0])
    assert ex["workflow_id"] == wf["id"]
    assert ex["input_data"]["name"] == "Ann Lee"
    assert ex["input_data"]["additional_data"] == {"budget": "50k"}


def test_form_trigger_without_workflow_runs_default_pipeline(client):
    r = client.post(f"/api/triggers/form?key={client.user['trigger_key']}", json={"name": "Ann", "email": "ann@corp.io"})
    assert r.status_code == 202
    run_id = r.json()["run_id"]
    run = wait_for(lambda: (lambda d: d if d["status"] == "completed" else None)(client.get(f"/api/runs/{run_id}").json()))
    assert run["source"] == "form"


def test_form_trigger_validation(client):
    r = client.post(f"/api/triggers/form?key={client.user['trigger_key']}", json={"name": "Ann", "email": "nope"})
    assert r.status_code == 422


def test_trigger_key_identifies_the_account(client, anon):
    payload = {"name": "Ann", "email": "ann@corp.io"}
    assert anon.post("/api/triggers/form", json=payload).status_code == 401
    assert anon.post("/api/triggers/form?key=wrong", json=payload).status_code == 401
    r = anon.post("/api/triggers/form", json=payload, headers={"X-FlowMancer-Key": client.user["trigger_key"]})
    assert r.status_code == 202
    run_id = r.json()["run_id"]
    assert client.get(f"/api/runs/{run_id}").status_code == 200  # the run belongs to the key's owner

    rotated = client.post("/api/auth/trigger-key/rotate").json()["trigger_key"]
    assert rotated != client.user["trigger_key"]
    assert anon.post(f"/api/triggers/form?key={client.user['trigger_key']}", json=payload).status_code == 401
    assert anon.post(f"/api/triggers/form?key={rotated}", json=payload).status_code == 202


def test_webhook_trigger_runs_workflow(client):
    wf = create(client, hot_lead_graph(trigger="webhook"))
    key = client.user["trigger_key"]
    assert client.post(f"/api/triggers/webhook/{wf['id']}", json=LEAD).status_code == 401  # key required
    r = client.post(f"/api/triggers/webhook/{wf['id']}?key={key}", json=LEAD)
    assert r.status_code == 202
    assert finished(client, r.json()["workflow_execution_id"])["status"] == "completed"
    assert client.post(f"/api/triggers/webhook/999?key={key}", json=LEAD).status_code == 404
