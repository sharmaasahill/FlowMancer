"""
Application Configuration
Loads settings from environment variables
"""
from typing import List
from pydantic_settings import BaseSettings
from pydantic import validator


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "FlowMancer"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Security
    SECRET_KEY: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database
    DATABASE_URL: str
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # OpenAI (Optional - using Groq instead)
    OPENAI_API_KEY: str = ""
    
    # Groq (Free LLM API)
    GROQ_API_KEY: str
    
    # n8n Integration
    N8N_API_URL: str = ""
    N8N_API_KEY: str = ""
    
    # Zapier
    ZAPIER_WEBHOOK_URL: str = ""
    
    # Email
    EMAIL_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@flowmancer.com"
    
    # External APIs (Optional)
    CLEARBIT_API_KEY: str = ""
    APOLLO_API_KEY: str = ""
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    @validator("CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            import json
            return json.loads(v)
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()

