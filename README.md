# FlowMancer

**AI-Powered Multi-Agent Workflow Orchestrator**

FlowMancer is a production-ready automation platform that combines intelligent AI agents with popular automation tools like n8n and Zapier. Built with FastAPI, CrewAI, and Next.js, it enables businesses to automate complex workflows with contextual understanding and decision-making capabilities.

![FlowMancer](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![Next.js](https://img.shields.io/badge/next.js-14.0-black.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

---

## Features

### **Agentic AI**
- Multi-agent system using CrewAI
- Intelligent decision-making with GPT-4
- Context-aware workflow execution
- Agent collaboration and task delegation

### **Automation Integration**
- **n8n Integration**: Trigger and monitor n8n workflows
- **Zapier Integration**: Send/receive data via webhooks
- **Custom Workflows**: Build your own automation logic

### **Use Cases Included**
1. **Lead Qualification**: Intelligent lead scoring and routing
2. **Email Processing**: Automated categorization and response drafting
3. **Document Automation**: Extract, validate, and route documents

### **Modern Tech Stack**
- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, Redis
- **AI**: CrewAI, LangChain, OpenAI GPT-4
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **DevOps**: Docker, Docker Compose

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- OpenAI API Key

### Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/flowmancer.git
cd flowmancer
```

#### 2. Set Up Environment Variables

**Backend** (`backend/.env`):
```bash
cp backend/env.example backend/.env
```

Edit `backend/.env` and add your API keys:
```env
OPENAI_API_KEY=your-openai-api-key-here
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
```

**Frontend** (`frontend/.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### 3. Run with Docker Compose

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database (port 5432)
- Redis (port 6379)
- Backend API (port 8000)
- Frontend (port 3000)

#### 4. Access the Application

- **Frontend Dashboard**: http://localhost:3000
- **API Documentation**: http://localhost:8000/api/docs
- **API Alternative Docs**: http://localhost:8000/api/redoc

---

## Manual Setup (Without Docker)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up database
# Make sure PostgreSQL is running
# Create database: flowmancer_db

# Run the application
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

---

## Usage Examples

### 1. Lead Qualification API

```bash
curl -X POST http://localhost:8000/api/use-cases/qualify-lead \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@company.com",
    "company": "Acme Corp",
    "message": "Interested in enterprise plan"
  }'
```

### 2. Email Processing API

```bash
curl -X POST http://localhost:8000/api/use-cases/process-email \
  -H "Content-Type: application/json" \
  -d '{
    "from_email": "customer@example.com",
    "subject": "Product support needed",
    "body": "I need help with..."
  }'
```

### 3. Create a Workflow

```bash
curl -X POST http://localhost:8000/api/workflows/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lead Qualification Workflow",
    "description": "Automatically qualify and route leads",
    "workflow_type": "lead_qualification",
    "is_active": true
  }'
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│         Frontend (Next.js Dashboard)        │
│  - Workflow Management  - Analytics         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│      FastAPI Backend (REST + WebSocket)     │
│  - Authentication  - API Gateway            │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌──────────────┐    ┌──────────────────────┐
│ Agent System │◄──►│  Automation Layer    │
│  (CrewAI)    │    │  - n8n Connector     │
│              │    │  - Zapier Webhooks   │
└──────────────┘    └──────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│  External Services & Integrations    │
│  Gmail | Slack | Notion | CRM | DB   │
└──────────────────────────────────────┘
```

---

## Project Structure

```
flowmancer/
├── backend/
│   ├── app/
│   │   ├── agents/          # AI agent definitions
│   │   ├── api/             # API endpoints
│   │   ├── core/            # Core configuration
│   │   ├── integrations/    # n8n, Zapier integrations
│   │   ├── models/          # Database models
│   │   ├── schemas/         # Pydantic schemas
│   │   └── main.py          # FastAPI application
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # React components
│   │   ├── lib/             # API client, utilities
│   │   └── types/           # TypeScript types
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Configuration

### Environment Variables

#### Backend

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 | Yes | - |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `SECRET_KEY` | Application secret key | Yes | - |
| `N8N_API_URL` | n8n API endpoint | No | - |
| `N8N_API_KEY` | n8n API key | No | - |
| `ZAPIER_WEBHOOK_URL` | Zapier webhook URL | No | - |

#### Frontend

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes | http://localhost:8000 |

---

## Integration Guides

### n8n Integration

1. Install n8n locally or use n8n.cloud
2. Create a workflow in n8n
3. Get the workflow ID and API key
4. Add to `.env`:
```env
N8N_API_URL=http://localhost:5678/api/v1
N8N_API_KEY=your-n8n-api-key
```

### Zapier Integration

1. Create a Zap with webhook trigger
2. Get the webhook URL
3. Add to `.env`:
```env
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/your-id
```

---

## Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

---

## API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

### Key Endpoints

- `GET /` - API information
- `GET /health` - Health check
- `GET /api/workflows/` - List workflows
- `POST /api/workflows/` - Create workflow
- `POST /api/executions/` - Execute workflow
- `POST /api/use-cases/qualify-lead` - Qualify lead
- `POST /api/use-cases/process-email` - Process email
- `POST /api/use-cases/process-document` - Process document

---

## Deployment

### Production Deployment

1. **Update environment variables** for production
2. **Set DEBUG=False** in backend
3. **Use strong secret keys**
4. **Configure CORS properly**
5. **Set up SSL/TLS**

### Deployment Options

- **Cloud**: Deploy on AWS, GCP, Azure
- **Vercel**: Frontend on Vercel
- **Railway/Render**: Backend on Railway or Render
- **Docker**: Use Docker Compose in production

---

## License

MIT License - see LICENSE file for details

---

## Author

**Sahil Kumar Sharma**
- GitHub: [@sharmaasahill](https://github.com/sharmaasahill)
- LinkedIn: [/in/sharmaasahill](https://linkedin.com/in/sharmaasahill)

---

## Acknowledgments

- CrewAI for agent orchestration
- LangChain for LLM integration
- FastAPI for the awesome Python framework
- Next.js for the React framework

---

## Support

For support, email i.sahilkrsharma@gmail.com or open an issue on GitHub.

---

**Built using AI and Automation**

