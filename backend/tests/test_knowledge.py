from app.services.knowledge import chunk_text

POLICY = ("Refund policy: customers can request a full refund within 30 days of purchase. "
          "Refunds are processed to the original payment method within 5 business days.")


def test_chunking_respects_size_and_keeps_text():
    text = "\n\n".join(f"Paragraph {i} " + "word " * 60 for i in range(10))
    chunks = chunk_text(text, size=400, overlap=50)
    assert len(chunks) > 1
    assert all(len(c) <= 400 for c in chunks)
    assert "Paragraph 9" in chunks[-1]
    assert chunk_text("   ") == []


def test_add_search_and_delete(client):
    r = client.post("/api/knowledge/text", json={"name": "Refunds", "text": POLICY})
    assert r.status_code == 201
    doc = r.json()
    assert doc["chunks"] == 1

    hits = client.get("/api/knowledge/search", params={"q": "refund within 30 days"}).json()["results"]
    assert hits and hits[0]["doc_name"] == "Refunds"

    assert len(client.get("/api/knowledge/").json()) == 1
    assert client.delete(f"/api/knowledge/{doc['id']}").status_code == 200
    assert client.get("/api/knowledge/search", params={"q": "refund"}).json()["results"] == []
    assert client.delete(f"/api/knowledge/{doc['id']}").status_code == 404


def test_upload_knowledge_file(client):
    files = {"file": ("faq.md", b"# FAQ\n\nWe are open Monday to Friday, 9am to 5pm.", "text/markdown")}
    r = client.post("/api/knowledge/upload", files=files)
    assert r.status_code == 201 and r.json()["name"] == "faq.md"


def test_email_reply_uses_knowledge(client, ai):
    client.post("/api/knowledge/text", json={"name": "Refunds", "text": POLICY})
    run = client.post("/api/use-cases/process-email", json={
        "from_email": "c@x.com", "subject": "Refund request",
        "body": "Can I get a refund? I purchased 10 days ago."}).json()
    assert run["knowledge"] and run["knowledge"][0]["doc_name"] == "Refunds"
    knowledge_step = next(s for s in run["steps"] if s["name"] == "Knowledge lookup")
    assert knowledge_step["status"] == "completed"
    assert "full refund within 30 days" in ai.prompts[-1]


def test_unrelated_question_gets_no_knowledge(client, ai):
    client.post("/api/knowledge/text", json={"name": "Refunds", "text": POLICY})
    run = client.post("/api/use-cases/process-email", json={
        "from_email": "c@x.com", "subject": "Partnership", "body": "Let's collaborate on marketing events."}).json()
    assert run["knowledge"] == []
