from app.core.config import settings

LEAD = {"name": "John Doe", "email": "john@techcorp.com", "company": "Tech Corp", "message": "500 users"}
EMAIL = {"from_email": "jane@customer.com", "subject": "Login broken", "body": "Can't log in!",
         "message_id": "<abc@mail>"}


def pending(client):
    return client.get("/api/approvals/?status=pending").json()


def test_hot_lead_creates_crm_approval_and_slack_alert(client, http_calls, monkeypatch):
    monkeypatch.setattr(settings, "SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T/B/X")
    run = client.post("/api/use-cases/qualify-lead", json=LEAD).json()

    assert run["actions"][0]["action"] == "slack_alert"
    assert run["actions"][0]["status"] == "success"
    assert "Hot lead" in http_calls[0]["json"]["text"]

    approvals = pending(client)
    assert len(approvals) == 1
    a = approvals[0]
    assert a["action"] == "crm_contact" and a["run_id"] == run["id"]
    assert a["payload"]["firstname"] == "John" and a["payload"]["lastname"] == "Doe"


def test_low_lead_creates_no_approval(client, ai):
    ai.set_lead_score(20)
    run = client.post("/api/use-cases/qualify-lead", json=LEAD).json()
    assert run["output"]["qualification"] == "Low"
    assert run["output"]["assigned_to"] == "Nurture"  # weak leads aren't routed to a sales team
    assert pending(client) == []


def test_qualified_lead_is_never_left_in_nurture(client, ai):
    ai.set_lead_score(55)
    ai.responses["lead"]["assigned_to"] = "Nurture"
    run = client.post("/api/use-cases/qualify-lead", json=LEAD).json()
    assert run["output"]["qualification"] == "Medium"
    assert run["output"]["assigned_to"] == "Enterprise sales"  # company_size got the full 25 points


def test_approve_with_edits_runs_hubspot(client, http_calls, monkeypatch):
    monkeypatch.setattr(settings, "HUBSPOT_ACCESS_TOKEN", "pat-test")
    client.post("/api/use-cases/qualify-lead", json=LEAD)
    a = pending(client)[0]

    r = client.post(f"/api/approvals/{a['id']}/approve", json={"payload": {"company": "TechCorp Inc"}, "note": "ok"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "approved"
    assert body["result"]["status"] == "success"
    sent = http_calls[-1]
    assert "hubapi.com" in sent["url"]
    assert sent["headers"]["Authorization"] == "Bearer pat-test"
    assert sent["json"]["inputs"][0]["properties"]["company"] == "TechCorp Inc"
    # Non-HubSpot fields are not sent as contact properties
    assert "lead_score" not in sent["json"]["inputs"][0]["properties"]


def test_approve_without_integration_is_recorded_as_skipped(client):
    client.post("/api/use-cases/qualify-lead", json=LEAD)
    a = pending(client)[0]
    body = client.post(f"/api/approvals/{a['id']}/approve", json={}).json()
    assert body["status"] == "approved"
    assert body["result"]["status"] == "skipped"


def test_cannot_decide_twice_or_add_unknown_fields(client):
    client.post("/api/use-cases/qualify-lead", json=LEAD)
    a = pending(client)[0]
    assert client.post(f"/api/approvals/{a['id']}/approve", json={"payload": {"hack": 1}}).status_code == 422
    assert client.post(f"/api/approvals/{a['id']}/reject", json={"note": "no"}).json()["status"] == "rejected"
    assert client.post(f"/api/approvals/{a['id']}/approve", json={}).status_code == 409


def test_email_reply_approval_and_spam(client, ai):
    client.post("/api/use-cases/process-email", json=EMAIL)
    a = pending(client)[0]
    assert a["action"] == "email_reply"
    assert a["payload"] == {"to": "jane@customer.com", "subject": "Login broken",
                            "body": "Hi, sorry about that. We're on it.", "in_reply_to": "<abc@mail>"}

    ai.responses["email"].update(category="spam", draft_reply="Buy now")
    run = client.post("/api/use-cases/process-email", json=EMAIL).json()
    assert run["output"]["draft_reply"] == ""  # spam never gets a reply
    assert len(pending(client)) == 1


def test_email_reply_saves_mailbox_draft(client, monkeypatch):
    from app.services import approvals as service
    saved = {}

    def fake_draft(to, subject, body, in_reply_to=None):
        saved.update(to=to, subject=subject, body=body, in_reply_to=in_reply_to)
        return {"status": "success", "detail": "Draft saved"}
    monkeypatch.setattr(service, "append_draft", fake_draft)

    client.post("/api/use-cases/process-email", json=EMAIL)
    a = pending(client)[0]
    body = client.post(f"/api/approvals/{a['id']}/approve", json={"payload": {"body": "Edited reply"}}).json()
    assert body["result"]["status"] == "success"
    assert saved == {"to": "jane@customer.com", "subject": "Login broken", "body": "Edited reply",
                     "in_reply_to": "<abc@mail>"}


def test_document_totals_are_checked_in_code(client, ai):
    ai.responses["document"].update(
        line_items=[{"description": "Paper", "amount": 80.0}, {"description": "Toner", "amount": 60.0}],
        total_amount=400.0, ai_notes=["Paid VISA ****1234"])
    run = client.post("/api/use-cases/process-document", json={"file_content": "Invoice 77 total 400"}).json()
    o = run["output"]
    assert o["issues"] == ["Line items plus tax add up to 140, but the stated total is 400"]
    assert o["ai_notes"] == ["Paid VISA ****1234"]  # model notes are kept for display but don't decide validity
    assert o["validation_status"] == "invalid"
    assert o["approval_required"] is True  # anything that isn't valid needs approval


def test_labelled_issuer_beats_model_guess(client, ai):
    ai.responses["document"].update(counterparty="FlowMancer Inc")  # the bill-to party
    o = client.post("/api/use-cases/process-document", json={
        "file_content": "INVOICE 1\nFrom: Acme Cloud Services Pvt Ltd\nTo: FlowMancer Inc\nTotal 500"}).json()["output"]
    assert o["counterparty"] == "Acme Cloud Services Pvt Ltd"


def test_document_totals_with_tax_pass(client, ai):
    ai.responses["document"].update(
        line_items=[{"description": "Licences", "amount": 4500.0}, {"description": "Support", "amount": 500.0}],
        tax_amount=900.0, total_amount=5900.0)
    o = client.post("/api/use-cases/process-document", json={"file_content": "Invoice"}).json()["output"]
    assert o["issues"] == [] and o["validation_status"] == "valid"


def test_document_cleanup_of_model_mistakes(client, ai):
    ai.responses["document"].update(
        document_type="receipt", due_date="null", tax_amount=7.75, total_amount=7.75,
        line_items=[{"description": "Latte", "amount": 4.5}, {"description": "Muffin", "amount": 3.25},
                    {"description": "Total", "amount": 7.75}])
    o = client.post("/api/use-cases/process-document", json={"file_content": "Receipt"}).json()["output"]
    assert o["due_date"] is None
    assert [i["description"] for i in o["line_items"]] == ["Latte", "Muffin"]
    assert o["tax_amount"] is None
    assert o["issues"] == [] and o["validation_status"] == "valid"
    assert o["approval_required"] is False  # small, valid receipt


def test_document_missing_vendor_is_flagged(client, ai):
    ai.responses["document"].update(counterparty=None)
    o = client.post("/api/use-cases/process-document", json={"file_content": "Invoice"}).json()["output"]
    assert "Issuer/vendor not identified" in o["issues"]


def test_document_rules_force_approval_over_threshold(client, ai):
    doc = {"document_type": "invoice", "file_content": "Invoice total 5000 USD"}
    ai.responses["document"].update(total_amount=5000.0, line_items=[{"description": "x", "amount": 5000.0}])
    run = client.post("/api/use-cases/process-document", json=doc).json()
    assert run["output"]["approval_required"] is True
    assert run["output"]["approver"] == "Finance"
    a = pending(client)[0]
    assert a["action"] == "document_approval"
    assert "5000" in a["title"]


def test_small_valid_invoice_needs_no_approval(client):
    run = client.post("/api/use-cases/process-document",
                      json={"document_type": "invoice", "file_content": "Total 500"}).json()
    assert run["output"]["approval_required"] is False
    assert pending(client) == []
