"""
Application settings, loaded from environment variables / backend/.env.
Only GEMINI_API_KEY is required; everything else has a working default.
"""
import json
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    APP_NAME: str = "FlowMancer"
    APP_VERSION: str = "3.0.0"
    DEBUG: bool = False

    # SQLite for local dev; postgresql://user:pass@host:5432/db in production
    DATABASE_URL: str = "sqlite:///./flowmancer.db"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

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

    # ---------- Lead research ----------
    # Sends the company name and email domain to DuckDuckGo and fetches the company website
    RESEARCH_ENABLED: bool = True
    RESEARCH_MAX_RESULTS: int = 5

    # ---------- Knowledge base ----------
    KNOWLEDGE_PATH: str = "./knowledge_data"

    # ---------- Business rules ----------
    HOT_LEAD_THRESHOLD: int = 80            # score >= this posts a Slack alert
    DOCUMENT_APPROVAL_AMOUNT: float = 1000  # documents at/above this total always need approval

    # ---------- Inbox (IMAP; Gmail/Outlook app password) ----------
    IMAP_HOST: str = ""
    IMAP_PORT: int = 993
    IMAP_USER: str = ""
    IMAP_PASSWORD: str = ""
    IMAP_FOLDER: str = "INBOX"
    IMAP_DRAFTS_FOLDER: str = "[Gmail]/Drafts"  # Outlook: "Drafts"
    INBOX_POLL_SECONDS: int = 0                 # 0 = only when you click "Check inbox"
    INBOX_MAX_PER_POLL: int = 10

    # ---------- Actions ----------
    SLACK_WEBHOOK_URL: str = ""
    HUBSPOT_ACCESS_TOKEN: str = ""
    WEBHOOK_URL: str = ""  # default outbound webhook (Zapier, n8n, Make...)

    # Optional shared secret for the public form/webhook triggers
    TRIGGER_SECRET: str = ""
    MAX_UPLOAD_MB: int = 10

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        return json.loads(v) if isinstance(v, str) else v

    @property
    def imap_configured(self) -> bool:
        return bool(self.IMAP_HOST and self.IMAP_USER and self.IMAP_PASSWORD)


settings = Settings()
