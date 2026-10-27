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
| **Email** (IMAP inbox or pasted) | Category, priority, sentiment, owning team, and a **reply grounded in your knowledge base** | Save the reply to your Gmail Drafts (needs approval). Slack alert if urgent |
| **Document** (PDF upload or text) | Type, issuer, number, dates, line items, tax and total, with **totals checked in code** | Finance or Legal approval when the policy requires it |

You can also ask questions in plain English ("which hot leads came in this week?", "draft a reply to run #12"). The **Ask FlowMancer** assistant looks the answer up in your own runs, approvals and knowledge base.

**Measured accuracy:** 30 out of 30 labelled test cases correct (12 leads, 10 emails, 8 documents) with the default Gemini model, 8.2 s per case on average in quick mode. The cases and the scoring script are in [`backend/eval/`](backend/eval), and the full report is in [`backend/eval/results/`](backend/eval/results). See [Accuracy test set](#accuracy-test-set) to run it yourself.

## Features

- **Structured output.** The model fills a JSON schema, so results are real fields you can sort, chart and branch on. Rules a model can get wrong are done in code: adding up the score, checking that line items plus tax equal the total, and the approval policy.
- **Gemini with automatic fallback.** The default is Google's free Gemini tier. If the main model is busy or rate-limited, FlowMancer retries on a backup Gemini model, then optionally on a local Ollama model. Only temporary errors trigger a fallback; a bad API key fails immediately with a clear message.
- **Two modes.** `quick` is one AI pass. `crew` is a CrewAI pipeline of four specialist agents working in sequence (Analyzer → Research → Scoring → Routing for leads).
- **Live progress.** Every step, including each crew agent, streams to the browser over Server-Sent Events.
- **Real research.** DuckDuckGo search (no key needed) plus the company website taken from the email domain. Sources are stored and shown, and private network addresses are never fetched.
- **Knowledge base (RAG).** Upload pricing, policies or FAQs. They're chunked, embedded locally with ChromaDB and quoted in replies.
- **Human approval queue.** Edit a proposed reply or contact, then approve or reject it.
- **Ask FlowMancer assistant.** A chat drawer (top bar, or `Ctrl+J`) that answers questions using tools: search runs, open one run, list approvals, search the knowledge base, show stats, and draft a reply. A draft only goes into the approval queue. The assistant can't send anything, and it only sees the signed-in account's data.
- **Accounts.** Email and password sign-in. Each account has its own runs, workflows, approvals and knowledge base. Passwords are hashed with scrypt, sessions use signed tokens (JWT), and repeated failed sign-ins are slowed down.
- **Triggers:** website form webhook, IMAP inbox polling, per-workflow webhooks, file upload.
- **Actions:** Slack, HubSpot, mailbox reply drafts, and outbound webhooks for Zapier, n8n and Make.
- **Visual workflow builder.** Drag-and-drop trigger, AI, condition and action steps, with templates. Graphs are validated on save (one trigger, no loops), and a test run lights up the path it took.
- **Dashboard.** Live counts, activity charts, an AI status panel and full run history.
- **Tests.** 85 backend tests that use a fake model, so they run with no API key or network. They include checks that one account can't read another's data. CI also lints and builds the frontend.
- **Accuracy test set.** 30 labelled cases scored against the real model, with a Markdown report.

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

Open **http://localhost:3000** and create an account. The first account on a server also takes ownership of any data that existed before accounts were added. Then go to **Studio**, click an example such as "Refund request", and press the button to watch it work.

> **Windows tip:** call the venv's Python directly (`venv/Scripts/python.exe -m uvicorn ...`) instead of `uvicorn`. Some terminals (MSYS2/UCRT64) and Windows Smart App Control block the bare `.exe` launchers.

### Tests

```bash
cd backend && venv/Scripts/python.exe -m pytest     # no API key or network needed
cd frontend && npm run lint && npm run build
```

### Accuracy test set

[`backend/eval/cases.json`](backend/eval/cases.json) holds 30 hand-labelled inputs, each with the expected answer (lead qualification; email category, priority, sentiment and what the reply must mention; document type, issuer, total, totals check and whether it needs approval). The runner sends every case to the real model and writes a report to `backend/eval/results/`.

```bash
cd backend
venv/Scripts/python.exe -m eval.run_eval                     # default model from .env (~5 min)
venv/Scripts/python.exe -m eval.run_eval --only email        # one kind of case
venv/Scripts/python.exe -m eval.run_eval --provider ollama   # compare with the local model
```

It uses a temporary database and knowledge store, so your own data is not touched. Web research is off so results don't change from day to day. The runner waits a few seconds between cases (`--delay`) to stay under the Gemini free-tier rate limit.

| Model | Leads | Emails | Documents | Total | Avg time |
|-------|-------|--------|-----------|-------|----------|
| `gemini-3.5-flash-lite` | 12/12 | 10/10 | 8/8 | **30/30 (100%)** | 8.2 s |

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
| `HUBSPOT_ACCESS_TOKEN` | HubSpot Service Key (Development → Keys → Service keys) with `crm.objects.contacts.read` and `.write` | - |
| `WEBHOOK_URL` | Default outbound webhook (Zapier / n8n / Make) | - |
| `IMAP_HOST` / `IMAP_USER` / `IMAP_PASSWORD` | Inbox trigger and reply drafts. Gmail: `imap.gmail.com` + an [App Password](https://myaccount.google.com/apppasswords) | - |
| `JWT_SECRET` | Signs sign-in tokens. Empty = generated and saved in `backend/.flowmancer_secret`. Set 32+ random characters for Docker or a server | generated |
| `ALLOW_SIGNUPS` | `false` stops new sign-ups (the first account is always allowed) | `true` |
| `INBOX_OWNER_EMAIL` | Account that receives emails from the IMAP inbox | first account |

Integrations you haven't set up are reported as "skipped" and never break a run. The **Integrations** page shows what's connected. Slack, HubSpot and the inbox are set once per server and shared by all accounts.

### Triggers and your trigger key

The public triggers (`/api/triggers/form` and `/api/triggers/webhook/{id}`) are called by other websites, so they can't use your sign-in. Instead, each account has a **trigger key**. Copy it from the **Integrations** page and add it to the URL as `?key=...` or send it in the `X-FlowMancer-Key` header. The run is saved to the account that owns the key. If the key leaks, press **Rotate** to replace it; the old key stops working.

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
  api/           routes: auth, assistant, use_cases, runs, approvals, knowledge, triggers, workflows, executions, system
  core/          settings, database, llm (Gemini/Ollama + fallback chain), security (passwords, tokens)
  integrations/  slack, hubspot, webhook, mail (IMAP)
  models/        User, Run, Approval, Workflow, WorkflowExecution, KnowledgeDocument
  schemas/       API schemas + the structured AI result schemas
  services/      processing pipeline, runs, approvals, research, knowledge, workflow engine, inbox, stats,
                 accounts, assistant (tool-calling chat)
backend/eval/    accuracy test set (cases.json), runner, saved reports
backend/tests/   pytest suite (fake model, fake embeddings)
frontend/src/
  app/           pages: login, overview, studio, history, workflows (+ builder), approvals, knowledge, integrations
  components/    shell (sidebar, command palette), assistant drawer, Studio, run timeline/result, workflow builder, charts
  lib/           API client, auth, live-run hook, examples, workflow templates
```

## API overview

Every endpoint except sign-in, the public triggers and health checks needs an `Authorization: Bearer <token>` header. Get a token from `/api/auth/login`.

| Endpoint | What it does |
|----------|--------------|
| `POST /api/auth/register` · `/api/auth/login` · `GET /api/auth/me` | Create an account, sign in (returns a token), current user |
| `POST /api/auth/trigger-key/rotate` | Replace your trigger key |
| `POST /api/assistant/chat` | Ask FlowMancer: send the conversation, get a reply plus the tools it used |
| `POST /api/use-cases/qualify-lead` · `process-email` · `process-document` `?mode=quick\|crew` | Process and wait for the result |
| `POST /api/use-cases/jobs/{lead\|email\|document}` | Start in the background; returns a run id |
| `POST /api/use-cases/process-document/upload` | Upload a file (multipart) |
| `GET /api/runs` · `/api/runs/{id}` · `/api/runs/{id}/events` | History, one run, live SSE stream |
| `GET /api/approvals?status=pending` · `POST /api/approvals/{id}/approve\|reject` | Approval queue |
| `GET\|POST\|DELETE /api/knowledge…` · `GET /api/knowledge/search?q=` | Knowledge base |
| `POST /api/triggers/form?key=` · `/api/triggers/webhook/{workflow_id}?key=` · `/api/triggers/inbox/poll` | Triggers (form and webhook use your trigger key) |
| `GET\|POST\|PUT\|DELETE /api/workflows…` · `POST /api/workflows/{id}/run` · `GET /api/executions/{id}` | Workflows |
| `GET /api/stats` · `GET /api/integrations` | Dashboard data and status |

```bash
# Send a lead as if it came from your website form (key from the Integrations page)
curl -X POST "http://localhost:8000/api/triggers/form?key=YOUR_TRIGGER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Priya Sharma","email":"priya@stripe.com","company":"Stripe","message":"Automate lead routing for our 300-person sales team this quarter. Budget approved."}'
```

## Docker

```bash
cp backend/env.example backend/.env    # add GEMINI_API_KEY
docker compose up -d --build
```

This starts PostgreSQL, the backend on port 8000 and the frontend on port 3000. Set `JWT_SECRET` in `backend/.env` first. Otherwise the container makes a new one each time it's rebuilt, and everyone has to sign in again.

---

## Known limitations

- **Accounts are basic.** There's no password reset, email verification or roles. Rate limiting covers failed sign-ins only. The sign-in token is kept in the browser's local storage, so a script injected into the page could read it.
- **Integrations are per server, not per account.** Every account posts to the same Slack channel and HubSpot portal, and the inbox belongs to one account.
- **The accuracy test set is small** (30 cases written by the author). It catches regressions; it doesn't prove the model is right on real-world data.
- **Research is best-effort.** Web results can be outdated or about a different company with the same name. Sources are shown so a person can check them.
- **Scanned PDFs** (images) need OCR, which isn't included.
- **The inbox uses IMAP app passwords,** not OAuth. Fetched emails are marked as read.
- **Run one backend process.** The knowledge store is a local folder.
- **Gmail only for the inbox.** Outlook.com no longer accepts app passwords for IMAP.
- **Live testing so far.** Slack has been tested against a live workspace. Gmail sign-in and access to the Inbox and Drafts folders work with a real account. Fetching emails and saving drafts are covered by the test suite but not yet tested end to end on that account. The Docker setup and HubSpot are tested with fakes only.

## Author

**Sahil Kumar Sharma** · [GitHub](https://github.com/sharmaasahill) · [LinkedIn](https://linkedin.com/in/sharmaasahill)

## License

MIT
