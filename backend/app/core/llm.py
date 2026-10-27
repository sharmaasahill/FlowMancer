"""
Shared LLM factory.
Pick the provider with AI_PROVIDER in .env ("ollama" or "openai").

All AI calls in the app go through `structured_invoke`, `ask` or the CrewAI LLM
from `get_crew_llm`, which keeps them easy to swap out in tests.
"""
from typing import Type, TypeVar
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from app.core.config import settings

T = TypeVar("T", bound=BaseModel)


def get_llm(temperature: float = 0.7):
    """Return a LangChain chat model for the configured provider."""
    provider = settings.AI_PROVIDER.lower()

    if provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=settings.OLLAMA_MODEL,
            base_url=settings.OLLAMA_BASE_URL,
            temperature=temperature,
            num_ctx=settings.OLLAMA_NUM_CTX,
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


def ask(prompt: str, temperature: float = 0.7) -> str:
    """Send a single prompt and return the reply text."""
    return get_llm(temperature).invoke([HumanMessage(content=prompt)]).content


def structured_invoke(schema: Type[T], prompt: str, retries: int = 1) -> T:
    """
    Ask the model for a reply that matches `schema` (a Pydantic model).
    Ollama and OpenAI both constrain the output to the JSON schema.
    Retries once on a malformed reply.
    """
    llm = get_llm(temperature=0).with_structured_output(schema)
    last_error: Exception | None = None
    for _ in range(retries + 1):
        try:
            result = llm.invoke([HumanMessage(content=prompt)])
            if result is None:
                raise ValueError("Model returned no structured output")
            return result
        except Exception as e:  # malformed JSON / validation error
            last_error = e
    raise RuntimeError(f"Model did not return valid structured output: {last_error}")
