"""
Application settings, loaded from environment variables / backend/.env.
Only GEMINI_API_KEY is required; everything else has a working default.
"""
import json
from typing import Annotated, Dict, List

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    APP_NAME: str = "FlowMancer"
    APP_VERSION: str = "3.0.0"
    DEBUG: bool = False

    # SQLite for local dev; postgresql://user:pass@host:5432/db in production
    DATABASE_URL: str = "sqlite:///./flowmancer.db"
    # Frontend addresses allowed to call the API. Accepts a JSON list or a comma-separated list.
    CORS_ORIGINS: Annotated[List[str], NoDecode] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # ---------- Accounts ----------
    # Signs login tokens. Empty = generate one and keep it in ./.flowmancer_secret (fine for local use;
    # set a long random value in production).
    JWT_SECRET: str = ""
    ACCESS_TOKEN_DAYS: int = 7
    # Set to false after creating your account(s) to stop new sign-ups
    ALLOW_SIGNUPS: bool = True
    # "Sign in with Google": OAuth client ID from Google Cloud Console (empty = button hidden)
    GOOGLE_CLIENT_ID: str = ""

    # ---------- Public demo account ----------
    # "Try the demo" signs visitors into this shared, sandboxed account. Its data is reset every night,
    # it can't connect integrations or change its settings, and it has a daily run limit.
    DEMO_ENABLED: bool = True
    DEMO_EMAIL: str = "demo@flowmancer.dev"
    DEMO_PASSWORD: str = "flowmancer@demo"
    DEMO_DAILY_RUN_LIMIT: int = 30
    # Runs per day for every other account except the server owner (0 = no limit). Protects the
    # Gemini free-tier quota when sign-ups are open.
    DAILY_RUN_LIMIT: int = 20
    # What "a day" means for daily limits and the nightly demo reset, in minutes from UTC (330 = India)
    LOCAL_UTC_OFFSET_MINUTES: int = 330

    # ---------- AI ----------
    # "gemini" (Google, free tier) or "ollama" (local, offline)
    AI_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    # Used automatically when the main model is busy or rate-limited. Empty = no backup model.
    GEMINI_FALLBACK_MODEL: str = "gemini-3.1-flash-lite"
    # Last resort when Gemini is unreachable: use the local Ollama model
    OLLAMA_FALLBACK: bool = False
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_NUM_CTX: int = 8192
    AI_TIMEOUT_SECONDS: int = 90
    # Paid-tier prices in USD per 1M tokens [input, output], for the cost estimate on the Usage page.
    # Source: ai.google.dev/gemini-api/docs/pricing (standard tier, checked October 2026).
    # Models not listed show tokens but no cost. Local Ollama models cost nothing.
    AI_PRICES: Dict[str, List[float]] = {
        "gemini-3.5-flash-lite": [0.30, 2.50],
        "gemini-3.1-flash-lite": [0.25, 1.50],
    }

    # ---------- Lead research ----------
    # Sends the company name and email domain to DuckDuckGo and fetches the company website
    RESEARCH_ENABLED: bool = True
    RESEARCH_MAX_RESULTS: int = 5

    # ---------- Knowledge base ----------
    KNOWLEDGE_PATH: str = "./knowledge_data"

    # ---------- Business rules ----------
    HOT_LEAD_THRESHOLD: int = 80            # score >= this posts a Slack alert
    DOCUMENT_APPROVAL_AMOUNT: float = 1000  # documents at/above this total always need approval

    # ---------- Inbox (IMAP; Gmail app password) ----------
    IMAP_HOST: str = ""
    IMAP_PORT: int = 993
    IMAP_USER: str = ""
    IMAP_PASSWORD: str = ""
    IMAP_FOLDER: str = "INBOX"
    IMAP_DRAFTS_FOLDER: str = "[Gmail]/Drafts"
    INBOX_POLL_SECONDS: int = 0                 # 0 = only when you click "Check inbox"
    INBOX_MAX_PER_POLL: int = 10
    # Account that owns emails from this inbox. Empty = the first account created.
    INBOX_OWNER_EMAIL: str = ""

    # Sending approved replies (the "Send" option). Empty = derived from IMAP_HOST (imap.x -> smtp.x)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    # Check at start-up whether this host lets email out (Render's free plan blocks SMTP ports)
    SMTP_PROBE: bool = True
    # Mail relay: a Google Apps Script in the IMAP_USER Gmail account that sends over HTTPS
    # (docs/mail-relay.gs). Used for the server mailbox when set, so email works where SMTP is blocked.
    MAIL_RELAY_URL: str = ""
    MAIL_RELAY_SECRET: str = ""
    # The website address used in password-reset links. Empty = the browser's address, if it's in CORS_ORIGINS
    FRONTEND_URL: str = ""
    # ---------- Actions ----------
    # Server-level integrations below belong to the server owner (INBOX_OWNER_EMAIL, or the first account).
    # Every other account connects its own on the Integrations page.
    SLACK_WEBHOOK_URL: str = ""
    HUBSPOT_ACCESS_TOKEN: str = ""
    WEBHOOK_URL: str = ""  # default outbound webhook (Zapier, n8n, Make...)

    MAX_UPLOAD_MB: int = 10

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        """
        Accept ["https://a.app", "https://b.app"], https://a.app,https://b.app or a single address.
        Browsers send the Origin without a trailing slash, so one is removed if pasted.
        """
        if isinstance(v, str):
            text = v.strip().replace("\u201c", '"').replace("\u201d", '"')  # "smart" quotes from copy-paste
            try:
                parsed = json.loads(text) if text.startswith("[") else None
            except json.JSONDecodeError:
                parsed = None
            if parsed is None:
                parsed = text.strip("[]").split(",")
            v = parsed if isinstance(parsed, list) else [parsed]
        return [str(o).strip().strip("'\"").rstrip("/") for o in v if str(o).strip().strip("'\"")]

    @field_validator("DATABASE_URL")
    @classmethod
    def sqlalchemy_url(cls, v):
        # Hosts hand out postgres:// or postgresql:// URLs. SQLAlchemy rejects the first and maps the
        # second to the psycopg 3 driver; this project installs psycopg2, so name it explicitly.
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg2://" + v[len(prefix):]
        return v

    @field_validator("JWT_SECRET")
    @classmethod
    def strong_secret(cls, v):
        if v and len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters (or leave it empty to auto-generate one)")
        return v

    @property
    def imap_configured(self) -> bool:
        return bool(self.IMAP_HOST and self.IMAP_USER and self.IMAP_PASSWORD)


settings = Settings()
