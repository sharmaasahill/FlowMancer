# FlowMancer

**AI-Powered Multi-Agent Workflow Orchestrator**

FlowMancer reads your business inputs (sales leads, emails, documents), works out what they mean and proposes what to do next. A person approves before anything is sent. It runs on a free local model through [Ollama](https://ollama.com) by default; OpenAI is one setting away.

![CI](https://github.com/sharmaasahill/FlowMancer/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![Next.js](https://img.shields.io/badge/next.js-14-black.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

---

## What it does

| Input | FlowMancer returns | Then proposes |
|-------|--------------------|---------------|
| **Lead** (website form) | Score 0-100 with a per-category breakdown, level, owning team, next step, talking points, a company summary from **real web research** with source links | Add to HubSpot (approval). Slack alert if hot. |
| **Email** (inbox or pasted) | Category, priority, sentiment, owning team, and a **reply grounded in your knowledge base** | Save the reply as a Gmail/Outlook draft (approval). Slack alert if urgent. |
| **Document** (PDF upload or text) | Type, issuer, number, dates, line items, tax, total. **Totals are checked in code.** | Finance/Legal approval when the policy requires it. |

### Features
- **Structured output.** The model fills a JSON schema, so results are real fields you can sort, chart and branch on. Rules a small model gets wrong (adding up scores, checking totals, approval policy) are applied in code.
- **Real research.** Leads are researched with DuckDuckGo search (no API key needed) plus the company's own website (taken from the email domain). Sources are stored and shown, and the model is told to use only those facts.
- **Two modes.** `quick` makes one AI call and takes seconds. `crew` runs a CrewAI pipeline of 4 specialist agents, which takes minutes on a local model. Both show **live step-by-step progress** in the UI via Server-Sent Events.
- **Knowledge base (RAG).** Upload pricing, policies or FAQs (PDF/TXT/MD/CSV/HTML). Content is chunked, embedded locally with ChromaDB and retrieved per request.
- **Human approval.** Proposed actions wait in an Approvals queue where you can edit, approve or reject them. Nothing goes out until approved.
- **Triggers.** Website form webhook, IMAP inbox polling (Gmail/Outlook app password), generic workflow webhooks, file upload.
- **Actions.** Slack incoming webhooks, HubSpot contact upsert, mailbox reply drafts (IMAP), outbound webhooks for Zapier, n8n and Make.
- **Visual workflow builder.** Drag-and-drop graph of trigger, AI step, condition and action nodes, with templates. Workflows are validated on save (one trigger, no loops) and runs show a per-step log.
- **Dashboard and history.** Real statistics and charts, plus a searchable history of every run with input, result, steps and sources.
- **Tests and CI.** 50+ backend tests with a fake model (no Ollama needed), and a GitHub Actions workflow that runs the tests and the frontend lint and build.

### Tech stack
- **Backend**: FastAPI, SQLAlchemy (SQLite locally, PostgreSQL in Docker), CrewAI, LangChain, ChromaDB, ddgs, pdfplumber
- **AI**: Ollama `llama3.2` (default) or OpenAI
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, React Flow (`@xyflow/react`), Recharts

---

## Quick start (local)

**Prerequisites:** Python 3.11+, Node.js 18+, [Ollama](https://ollama.com/download)

```bash
# 1. AI model (keep the Ollama app running)
ollama pull llama3.2

# 2. Backend
cd backend
python -m venv venv
source venv/Scripts/activate        # Windows Git Bash; macOS/Linux: source venv/bin/activate
pip install -r requirements-dev.txt
cp env.example .env
python test_setup.py                 # two [OK] lines = config + model working
uvicorn app.main:app --reload

# 3. Frontend (new terminal)
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Open http://localhost:3000 (dashboard) and http://localhost:8000/api/docs (API).

The first knowledge-base upload downloads a small embedding model (~80 MB) once.

### Run the tests
```bash
cd backend && python -m pytest          # ~10 s, no Ollama or network needed
cd frontend && npm run lint && npm run build
```

---

## Configuration (`backend/.env`)

All settings are listed in [`backend/env.example`](backend/env.example). The main ones:

| Variable | Purpose |
|----------|---------|
| `AI_PROVIDER` | `ollama` (default) or `openai` (+ `OPENAI_API_KEY`, `OPENAI_MODEL`) |
| `OLLAMA_MODEL` | Any pulled model, e.g. `llama3.2`, `llama3.1:8b` (better, slower) |
| `RESEARCH_ENABLED` | Web research for leads. **Sends the company name and email domain to DuckDuckGo.** |
| `IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD` | Inbox trigger and reply drafts. Gmail: `imap.gmail.com` + an [App Password](https://myaccount.google.com/apppasswords) |
| `INBOX_POLL_SECONDS` | Auto-check the inbox every N seconds (0 = only on "Check inbox now") |
| `SLACK_WEBHOOK_URL` | [Slack incoming webhook](https://api.slack.com/messaging/webhooks) |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot Private App token with `crm.objects.contacts.write` |
| `ZAPIER_WEBHOOK_URL` | Default outbound webhook (Zapier / n8n / Make) |
| `TRIGGER_SECRET` | If set, form/webhook triggers require `?secret=` or `X-FlowMancer-Secret` |
| `HOT_LEAD_THRESHOLD`, `DOCUMENT_APPROVAL_AMOUNT` | Business rules (defaults 80 and 1000) |

Integrations that aren't configured are skipped and reported as "skipped"; nothing crashes. The **Integrations** page shows what's connected.

---

## API overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/use-cases/qualify-lead` · `process-email` · `process-document` `?mode=quick\|crew` | Process and wait for the result |
| `POST /api/use-cases/jobs/{lead\|email\|document}?mode=` | Start in the background, returns a run |
| `POST /api/use-cases/process-document/upload` | Upload a file (multipart) |
| `GET /api/runs` · `/api/runs/{id}` · `/api/runs/{id}/events` | History, details, live SSE stream |
| `GET /api/approvals?status=pending` · `POST /api/approvals/{id}/approve\|reject` | Approval queue |
| `GET\|POST\|DELETE /api/knowledge…` · `GET /api/knowledge/search?q=` | Knowledge base |
| `POST /api/triggers/form` | Website form (JSON or form-encoded) |
| `POST /api/triggers/webhook/{workflow_id}` | Run a workflow from any system |
| `POST /api/triggers/inbox/poll` | Check the inbox now |
| `GET\|POST\|PUT\|DELETE /api/workflows…` · `POST /api/workflows/{id}/run` · `GET /api/executions/{id}` | Workflows |
| `GET /api/stats` · `GET /api/integrations` | Dashboard data and status |

```bash
curl -X POST http://localhost:8000/api/use-cases/qualify-lead \
  -H "Content-Type: application/json" \
  -d '{"name":"Priya Sharma","email":"priya@stripe.com","company":"Stripe","message":"Automate lead routing for our 300-person sales team this quarter. Budget approved."}'
```

---

## Architecture

```
 Triggers                    AI pipeline                         Outcomes
 ─────────                   ───────────                         ────────
 Website form ─┐      ┌─ Research (web + site) ─┐
 Inbox (IMAP) ─┼─────▶│  Knowledge (ChromaDB)   ├─▶ quick: 1 call ─┐   ┌─▶ Slack alerts (automatic)
 Webhook ──────┤      └─────────────────────────┘   crew: 4 agents ─┼──▶│
 Upload / UI ──┘                                                    │   └─▶ Approvals ─▶ HubSpot / mail draft /
                          structured result + code rules ◀──────────┘                    Slack / webhook
                                     │
                          Visual workflows (trigger → AI → condition → actions)
```

```
backend/app/
  agents/        prompts + crew definitions per use case
  api/           routes: use_cases, runs, approvals, knowledge, triggers, workflows, executions, system
  core/          config, database, llm (provider factory)
  integrations/  slack, hubspot, webhook, mail (IMAP)
  models/        SQLAlchemy models (Run, Approval, Workflow, ...)
  schemas/       request/response + structured AI result schemas
  services/      processing pipeline, runs, approvals, research, knowledge, engine, inbox, stats
backend/tests/   pytest suite (fake model, fake embeddings)
frontend/src/
  app/           pages: dashboard, use-cases, workflows (+ builder), approvals, history, knowledge, integrations
  components/    UI, run timeline/result, workflow builder
  lib/           API client, SSE hook, templates
```

---

## Docker

Ollama keeps running on your machine; the backend container reaches it through `host.docker.internal`.

```bash
cp backend/env.example backend/.env
docker compose up -d --build
```

---

## Known limitations

- **No authentication yet.** Every endpoint is open to anyone who can reach port 8000. Keep it on your machine or a private network until auth is added (stage 4). `TRIGGER_SECRET` protects only the public triggers.
- **Local model quality.** `llama3.2` (3B) is fast and free but makes mistakes. Scoring is constrained to fixed values and documents are checked in code to compensate. A larger model (`llama3.1:8b`) or OpenAI gives better results.
- **Crew mode is slow on CPU**: about 5-10 minutes per item with a local model.
- **Scanned PDFs** (images) aren't supported. There's no OCR yet.
- **Inbox** uses IMAP with app passwords, not OAuth. Emails are marked as read when fetched.
- **One backend process.** The knowledge store is a local ChromaDB folder, so don't run two backend instances on the same data.

---

## Author

**Sahil Kumar Sharma** · [GitHub](https://github.com/sharmaasahill) · [LinkedIn](https://linkedin.com/in/sharmaasahill)

## License

MIT
