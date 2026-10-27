LEAD = {"name": "John", "email": "john@techcorp.com"}


def test_stats_reflect_real_runs(client, ai):
    empty = client.get("/api/stats").json()
    assert empty["totals"]["runs"] == 0 and empty["totals"]["success_rate"] is None
    assert len(empty["runs_per_day"]) == 14

    client.post("/api/use-cases/qualify-lead", json=LEAD)            # score 85 -> High
    ai.set_lead_score(55)
    client.post("/api/use-cases/qualify-lead", json=LEAD)            # Medium
    client.post("/api/use-cases/process-email", json={"from_email": "a@b.com", "subject": "s", "body": "b"})

    s = client.get("/api/stats").json()
    assert s["totals"]["runs"] == 3
    assert s["totals"]["completed"] == 3
    assert s["totals"]["success_rate"] == 100.0
    assert s["totals"]["pending_approvals"] == 3
    assert s["by_kind"] == {"lead": 2, "email": 1}
    assert s["leads"]["avg_score"] == 70.0
    assert s["leads"]["by_qualification"] == {"High": 1, "Medium": 1, "Low": 0}
    assert s["emails"]["by_category"] == {"support": 1}
    today = s["runs_per_day"][-1]
    assert today["lead"] == 2 and today["email"] == 1


def test_integrations_status(client):
    body = client.get("/api/integrations").json()
    assert body["slack"]["configured"] is False
    assert body["mailbox"]["configured"] is False
    assert body["ai"]["provider"] == "gemini"
    assert body["ai"]["reachable"] is False and "GEMINI_API_KEY" in body["ai"]["detail"]  # no key in tests
    assert body["webhook"]["configured"] is False


def test_timestamps_are_marked_utc(client):
    run = client.post("/api/use-cases/qualify-lead", json=LEAD).json()
    assert run["created_at"].endswith(("+00:00", "Z"))
    assert run["completed_at"].endswith(("+00:00", "Z"))
