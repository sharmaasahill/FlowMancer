"""
Application Configuration
Loads settings from environment variables / backend/.env
"""
import json
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings"""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    # Application
    APP_NAME: str = "FlowMancer"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Security
    SECRET_KEY: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Database
    DATABASE_URL: str = "sqlite:///./flowmancer.db"

    # AI provider: "ollama" (free, local) or "openai"
    AI_PROVIDER: str = "ollama"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_NUM_CTX: int = 8192  # context window; prompts with research + knowledge need more than the 4096 default
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Lead research (web search + company website). Sends the company name/domain to DuckDuckGo.
    RESEARCH_ENABLED: bool = True
    RESEARCH_MAX_RESULTS: int = 5

    # Knowledge base (local vector store)
    KNOWLEDGE_PATH: str = "./knowledge_data"

    # Business rules
    HOT_LEAD_THRESHOLD: int = 80          # score >= this triggers a Slack alert
    DOCUMENT_APPROVAL_AMOUNT: float = 1000  # documents at/above this amount always need approval

    # Inbox trigger (IMAP: works with Gmail/Outlook app passwords)
    IMAP_HOST: str = ""
    IMAP_PORT: int = 993
    IMAP_USER: str = ""
    IMAP_PASSWORD: str = ""
    IMAP_FOLDER: str = "INBOX"
    IMAP_DRAFTS_FOLDER: str = "[Gmail]/Drafts"  # Outlook: "Drafts"
    INBOX_POLL_SECONDS: int = 0                 # 0 = only poll when asked
    INBOX_MAX_PER_POLL: int = 10

    # Actions
    SLACK_WEBHOOK_URL: str = ""
    HUBSPOT_ACCESS_TOKEN: str = ""
    ZAPIER_WEBHOOK_URL: str = ""  # any outbound webhook (Zapier, n8n, Make...)

    # Optional shared secret for the public form/webhook triggers
    TRIGGER_SECRET: str = ""

    # Uploads
    MAX_UPLOAD_MB: int = 10

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    @property
    def imap_configured(self) -> bool:
        return bool(self.IMAP_HOST and self.IMAP_USER and self.IMAP_PASSWORD)


settings = Settings()
