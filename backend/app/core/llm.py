"""
Shared LLM factory.
Pick the provider with AI_PROVIDER in .env ("ollama" or "openai").
"""
from langchain_core.messages import HumanMessage
from app.core.config import settings


def get_llm(temperature: float = 0.7):
    """Return a LangChain chat model for the configured provider."""
    provider = settings.AI_PROVIDER.lower()

    if provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=settings.OLLAMA_MODEL,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=temperature,
        )

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=settings.OPENAI_MODEL,
            temperature=temperature,
            api_key=settings.OPENAI_API_KEY,
        )

    raise ValueError(f"Unsupported AI_PROVIDER: {settings.AI_PROVIDER}")


def get_crew_llm(temperature: float = 0.7):
    """Return a CrewAI LLM for the configured provider (used by the multi-agent crews)."""
    from crewai import LLM

    provider = settings.AI_PROVIDER.lower()

    if provider == "ollama":
        return LLM(
            model=f"ollama/{settings.OLLAMA_MODEL}",
            base_url=settings.OLLAMA_BASE_URL,
            temperature=temperature,
        )

    if provider == "openai":
        return LLM(
            model=f"openai/{settings.OPENAI_MODEL}",
            api_key=settings.OPENAI_API_KEY,
            temperature=temperature,
        )

    raise ValueError(f"Unsupported AI_PROVIDER: {settings.AI_PROVIDER}")


def model_label() -> str:
    """Human-readable name of the active model, returned in API responses."""
    if settings.AI_PROVIDER.lower() == "openai":
        return f"{settings.OPENAI_MODEL} (OpenAI)"
    return f"{settings.OLLAMA_MODEL} (Ollama)"


def ask(llm, prompt: str) -> str:
    """Send a single prompt and return the reply text."""
    return llm.invoke([HumanMessage(content=prompt)]).content
