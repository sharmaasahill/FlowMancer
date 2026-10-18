# FlowMancer

**AI-Powered Multi-Agent Workflow Orchestrator**

FlowMancer is an automation backend and dashboard that sends business data (leads, emails, documents) to an AI model and returns structured analysis and next steps. It runs on a free local model through [Ollama](https://ollama.com) by default, and can switch to OpenAI with one setting. Results can be forwarded to n8n or Zapier.

![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![Next.js](https://img.shields.io/badge/next.js-14.0-black.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

---

## Features

### Use cases
1. **Lead qualification**: score (0-100), quality level, reasoning, next action, priority
2. **Email processing**: category, priority, sentiment, drafted reply, owning team
3. **Document automation**: type, extracted data, validation status, approval routing

### Two processing modes
Every use-case endpoint accepts `?mode=`:
- `quick` (default): one LLM call. Takes seconds.
- `crew`: a CrewAI pipeline of 4 specialist agents working in sequence (for leads: Analyzer, Research Specialist, Scoring Expert, Routing Manager). Gives more detailed output but takes several minutes on a local model.

### Workflows
Save a workflow (`lead_qualification`, `email_processing`, `document_automation`), run it with input data in the background, then poll for the result. If a workflow has an n8n workflow ID or a Zapier webhook URL, the result is forwarded there.

### Tech stack
- **Backend**: FastAPI, SQLAlchemy (SQLite locally, PostgreSQL in Docker)
- **AI**: CrewAI, LangChain, Ollama (llama3.2) or OpenAI
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS

---

## Quick Start (local, no Docker)

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com/download)

### 1. Install the AI model
```bash
ollama pull llama3.2
```
Keep the Ollama app running in the background.

### 2. Backend
```bash
cd backend
python -m venv venv
source venv/Scripts/activate      # Windows Git Bash. macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
cp env.example .env
python test_setup.py              # should print two [OK] lines
uvicorn app.main:app --reload
```
The SQLite database file (`flowmancer.db`) is created automatically on first start.

### 3. Frontend (new terminal)
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

### 4. Open
- Dashboard: http://localhost:3000
- API docs (Swagger): http://localhost:8000/api/docs

---

## Run with Docker

Ollama still runs on your machine. The backend container reaches it through `host.docker.internal`.

```bash
cp backend/env.example backend/.env
docker compose up -d --build
```

This starts PostgreSQL (5432), the backend (8000) and the frontend (3000). The compose file overrides `DATABASE_URL` and `OLLAMA_BASE_URL`; everything else comes from `backend/.env`.

---

## Usage Examples

```bash
# Lead qualification (quick)
curl -X POST http://localhost:8000/api/use-cases/qualify-lead \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@techcorp.com","company":"Tech Corp","message":"Need enterprise plan for 500 users, budget approved"}'

# Same lead through the 4-agent crew (slow)
curl -X POST "http://localhost:8000/api/use-cases/qualify-lead?mode=crew" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@techcorp.com","company":"Tech Corp","message":"Need enterprise plan for 500 users, budget approved"}'

# Email processing
curl -X POST http://localhost:8000/api/use-cases/process-email \
  -H "Content-Type: application/json" \
  -d '{"from_email":"customer@example.com","subject":"Login broken","body":"I cannot log in since yesterday, urgent!"}'

# Document processing
curl -X POST http://localhost:8000/api/use-cases/process-document \
  -H "Content-Type: application/json" \
  -d '{"document_type":"invoice","file_content":"Invoice #123, Acme Ltd, Total $1,200, due 2026-11-01"}'

# Workflow: create, execute, check result
curl -X POST http://localhost:8000/api/workflows/ \
  -H "Content-Type: application/json" \
  -d '{"name":"Lead Flow","workflow_type":"lead_qualification","is_active":true}'

curl -X POST http://localhost:8000/api/executions/ \
  -H "Content-Type: application/json" \
  -d '{"workflow_id":1,"input_data":{"name":"Jane","email":"jane@co.com","company":"Co","message":"Interested"}}'

curl http://localhost:8000/api/executions/1
```

---

## Architecture

```
┌──────────────────────────────┐
│  Frontend (Next.js)          │
└──────────────┬───────────────┘
               │ REST
               ▼
┌──────────────────────────────┐
│  FastAPI backend             │
│  use-cases / workflows /     │
│  executions / webhooks       │
└───────┬──────────────┬───────┘
        ▼              ▼
┌──────────────┐ ┌─────────────────┐
│ AI layer     │ │ Integrations    │
│ quick: 1 call│ │ n8n, Zapier     │
│ crew: CrewAI │ └─────────────────┘
└──────┬───────┘
       ▼
 Ollama (local) or OpenAI
```

---

## Project Structure

```
backend/
  app/
    agents/          # Quick processors + CrewAI crews per use case
    api/             # use_cases, workflows, executions, webhooks
    core/            # config, database, llm (provider factory)
    integrations/    # n8n, Zapier
    models/          # SQLAlchemy models
    schemas/         # Pydantic schemas
    main.py
  test_setup.py      # checks config + LLM connection
frontend/
  src/app/           # pages
  src/components/
  src/lib/api.ts     # API client
docker-compose.yml
```

---

## Configuration (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | `ollama` or `openai` | `ollama` |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Any model you've pulled | `llama3.2` |
| `OPENAI_API_KEY` | Needed only when `AI_PROVIDER=openai` | - |
| `OPENAI_MODEL` | OpenAI model name | `gpt-4o-mini` |
| `DATABASE_URL` | SQLAlchemy URL | `sqlite:///./flowmancer.db` |
| `SECRET_KEY`, `JWT_SECRET_KEY` | Required strings | - |
| `N8N_API_URL`, `N8N_API_KEY` | Optional n8n integration | - |
| `ZAPIER_WEBHOOK_URL` | Optional Zapier webhook | - |
| `CORS_ORIGINS` | JSON list of allowed origins | localhost:3000 |

Frontend: `NEXT_PUBLIC_API_URL` in `frontend/.env.local` (default `http://localhost:8000`).

---

## Known Limitations

- **No authentication.** Every endpoint is open to anyone who can reach port 8000. Add auth before exposing it beyond your machine.
- **Research is not real.** Agents infer company details from the input only; nothing is fetched from the web or a CRM.
- **No automated tests** yet. `test_setup.py` is a connectivity check, not a test suite.
- Some dashboard stats (total executions, average response time) are placeholders.

---

## Author

**Sahil Kumar Sharma**
- GitHub: [@sharmaasahill](https://github.com/sharmaasahill)
- LinkedIn: [/in/sharmaasahill](https://linkedin.com/in/sharmaasahill)

## License

MIT
