# FlowMancer

**AI that reads your leads, emails and documents, and proposes what to do next. A person approves before anything goes out.**

FlowMancer researches a sales lead on the web, triages an email against your own policies, or checks an invoice. It returns a structured verdict (scores, categories, totals) and proposes an action: a CRM contact, a reply draft, a Finance sign-off. Nothing is sent until someone approves it.

![CI](https://github.com/sharmaasahill/FlowMancer/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![Next.js](https://img.shields.io/badge/next.js-14-black.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

---

## What it does

| Input | FlowMancer returns | Then proposes |
|-------|--------------------|---------------|
| **Lead** (website form, Studio, API) | Score 0–100 broken down into six categories, owning team, next step, talking points, and a company summary from **live web research**, with source links | Add to HubSpot (needs approval). Slack alert if the score is 80+ |
| **Email** (IMAP inbox or pasted) | Category, priority, sentiment, owning team, and a **reply grounded in your knowledge base** | Save the reply to your Gmail/Outlook Drafts (needs approval). Slack alert if urgent |
| **Document** (PDF upload or text) | Type, issuer, number, dates, line items, tax and total, with **totals checked in code** | Finance or Legal approval when the policy requires it |

Measured on 10 test cases with the default Gemini model: all 10 correct, 2–8 seconds each in quick mode. The same cases on a local 3B model were slower (20–70 s) and got several wrong. In particular, the local model labelled a refund request as spam, scored a 300-person enterprise lead 25/100, and missed an invoice whose lines didn't add up.

## Features

- **Structured output.** The model fills a JSON schema, so results are real fields you can sort, chart and branch on. Rules a model can get wrong are done in code: adding up the score, checking that line items plus tax equal the total, and the approval policy.
- **Gemini with automatic fallback.** The default is Google's free Gemini tier. If the main model is busy or rate-limited, FlowMancer retries on a backup Gemini model, then optionally on a local Ollama model. Only temporary errors trigger a fallback; a bad API key fails immediately with a clear message.
- **Two modes.** `quick` is one AI pass. `crew` is a CrewAI pipeline of four specialist agents working in sequence (Analyzer → Research → Scoring → Routing for leads).
- **Live progress.** Every step, including each crew agent, streams to the browser over Server-Sent Events.
- **Real research.** DuckDuckGo search (no key needed) plus the company website taken from the email domain. Sources are stored and shown, and private network addresses are never fetched.
- **Knowledge base (RAG).** Upload pricing, policies or FAQs. They're chunked, embedded locally with ChromaDB and quoted in replies.
- **Human approval queue.** Edit a proposed reply or contact, then approve or reject it.
- **Triggers:** website form webhook, IMAP inbox polling, per-workflow webhooks, file upload.
- **Actions:** Slack, HubSpot, mailbox reply drafts, and outbound webhooks for Zapier, n8n and Make.
- **Visual workflow builder.** Drag-and-drop trigger, AI, condition and action steps, with templates. Graphs are validated on save (one trigger, no loops), and a test run lights up the path it took.
- **Dashboard.** Live counts, activity charts, an AI status panel and full run history.
- **Tests.** 63 backend tests that use a fake model, so they run in about 10 seconds with no API key. CI also lints and builds the frontend.

## Tech stack

| Layer | Tools |
|-------|-------|
| Backend | FastAPI, SQLAlchemy (SQLite locally, PostgreSQL in Docker), Pydantic |
| AI | Google Gemini via `langchain-google-genai`, CrewAI, optional Ollama |
| Retrieval | ChromaDB (local embeddings), DuckDuckGo (`ddgs`), pdfplumber |
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Framer Motion, React Flow, Recharts |

---

## Quick start

**You need:** Python 3.11+, Node.js 18+, and a free Gemini API key from [Google AI Studio](https://aistudio.google.com) ("Get API key").

### 1. Backend

```bash
cd backend
python -m venv venv
venv/Scripts/python.exe -m pip install -r requirements-dev.txt     # macOS/Linux: venv/bin/python
cp env.example .env              # then put your key in GEMINI_API_KEY
venv/Scripts/python.exe check_setup.py                             # two [OK] lines = ready
venv/Scripts/python.exe -m uvicorn app.main:app --reload
```

The API runs at http://localhost:8000, with interactive docs at `/api/docs`.

### 2. Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**. Go to **Studio**, click an example such as "Refund request", and press the button to watch it work.

> **Windows tip:** call the venv's Python directly (`venv/Scripts/python.exe -m uvicorn ...`) instead of `uvicorn`. Some terminals (MSYS2/UCRT64) and Windows Smart App Control block the bare `.exe` launchers.

### Tests

```bash
cd backend && venv/Scripts/python.exe -m pytest     # ~10 s, no API key or network needed
cd frontend && npm run lint && npm run build
```

---

## Configuration

Everything lives in `backend/.env`. Only `GEMINI_API_KEY` is required. [`backend/env.example`](backend/env.example) lists every setting.

| Setting | Purpose | Default |
|---------|---------|---------|
| `GEMINI_API_KEY` | Free key from Google AI Studio | **required** |
| `GEMINI_MODEL` | Main model | `gemini-3.5-flash-lite` |
| `GEMINI_FALLBACK_MODEL` | Used when the main model is busy (empty = none) | `gemini-3.1-flash-lite` |
| `OLLAMA_FALLBACK` | Use the local Ollama model as a last resort | `false` |
| `AI_PROVIDER` | `gemini`, or `ollama` to run fully offline | `gemini` |
| `SLACK_WEBHOOK_URL` | [Slack incoming webhook](https://api.slack.com/messaging/webhooks) | - |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot Private App token (`crm.objects.contacts.write`) | - |
| `WEBHOOK_URL` | Default outbound webhook (Zapier / n8n / Make) | - |
| `IMAP_HOST` / `IMAP_USER` / `IMAP_PASSWORD` | Inbox trigger and reply drafts. Gmail: `imap.gmail.com` + an [App Password](https://myaccount.google.com/apppasswords) | - |
| `TRIGGER_SECRET` | Require a secret on the public form and webhook triggers | - |

Integrations you haven't set up are reported as "skipped" and never break a run. The **Integrations** page shows what's connected.

**About the Gemini free tier:** it has per-minute and per-day request limits, and Google may use free-tier requests to improve its products. Don't send real customer data through it. Quick mode uses 1 request per item; crew mode uses about 5.

---

## How it works

```
 Triggers                    Pipeline                                    Outcomes
 ────────                    ────────                                    ────────
 Website form ─┐     ┌─ Research (web + company site) ─┐
 Inbox (IMAP) ─┼────▶│  Knowledge base (ChromaDB)      ├─▶ quick: 1 call ──┐   ┌─▶ Slack alert (automatic)
 Webhook ──────┤     └─────────────────────────────────┘   crew: 4 agents ─┼──▶│
 Studio / API ─┘                                                           │   └─▶ Approval queue ─▶ HubSpot · mail draft
                      Gemini (→ backup model → Ollama)                     │                         Slack · webhook
                      structured result + rules in code ◀──────────────────┘
                                     │
                      Visual workflows: trigger → AI → condition → actions
```

```
backend/app/
  agents/        prompts and crew definitions per use case
  api/           routes: use_cases, runs, approvals, knowledge, triggers, workflows, executions, system
  core/          settings, database, llm (Gemini/Ollama + fallback chain)
  integrations/  slack, hubspot, webhook, mail (IMAP)
  models/        Run, Approval, Workflow, WorkflowExecution, KnowledgeDocument
  schemas/       API schemas + the structured AI result schemas
  services/      processing pipeline, runs, approvals, research, knowledge, workflow engine, inbox, stats
backend/tests/   pytest suite (fake model, fake embeddings)
frontend/src/
  app/           pages: overview, studio, history, workflows (+ builder), approvals, knowledge, integrations
  components/    shell (sidebar, command palette), Studio, run timeline/result, workflow builder, charts
  lib/           API client, live-run hook, examples, workflow templates
```

## API overview

| Endpoint | What it does |
|----------|--------------|
| `POST /api/use-cases/qualify-lead` · `process-email` · `process-document` `?mode=quick\|crew` | Process and wait for the result |
| `POST /api/use-cases/jobs/{lead\|email\|document}` | Start in the background; returns a run id |
| `POST /api/use-cases/process-document/upload` | Upload a file (multipart) |
| `GET /api/runs` · `/api/runs/{id}` · `/api/runs/{id}/events` | History, one run, live SSE stream |
| `GET /api/approvals?status=pending` · `POST /api/approvals/{id}/approve\|reject` | Approval queue |
| `GET\|POST\|DELETE /api/knowledge…` · `GET /api/knowledge/search?q=` | Knowledge base |
| `POST /api/triggers/form` · `/api/triggers/webhook/{workflow_id}` · `/api/triggers/inbox/poll` | Triggers |
| `GET\|POST\|PUT\|DELETE /api/workflows…` · `POST /api/workflows/{id}/run` · `GET /api/executions/{id}` | Workflows |
| `GET /api/stats` · `GET /api/integrations` | Dashboard data and status |

```bash
curl -X POST http://localhost:8000/api/use-cases/qualify-lead \
  -H "Content-Type: application/json" \
  -d '{"name":"Priya Sharma","email":"priya@stripe.com","company":"Stripe","message":"Automate lead routing for our 300-person sales team this quarter. Budget approved."}'
```

## Docker

```bash
cp backend/env.example backend/.env    # add GEMINI_API_KEY
docker compose up -d --build
```

This starts PostgreSQL, the backend on port 8000 and the frontend on port 3000.

---

## Known limitations

- **No login yet.** Every endpoint is open to anyone who can reach port 8000, so keep it on your machine. `TRIGGER_SECRET` protects only the public triggers.
- **Research is best-effort.** Web results can be outdated or about a different company with the same name. Sources are shown so a person can check them.
- **Scanned PDFs** (images) need OCR, which isn't included.
- **The inbox uses IMAP app passwords,** not OAuth. Fetched emails are marked as read.
- **Run one backend process.** The knowledge store is a local folder.
- **The Docker setup and the Slack/HubSpot/IMAP integrations** are tested with fakes in the test suite, not against live accounts.

## Author

**Sahil Kumar Sharma** · [GitHub](https://github.com/sharmaasahill) · [LinkedIn](https://linkedin.com/in/sharmaasahill)

## License

MIT
