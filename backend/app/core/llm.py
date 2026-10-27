"""
AI model access.

Every AI call goes through a short chain of "targets":
    1. GEMINI_MODEL            (main)
    2. GEMINI_FALLBACK_MODEL   (when the main model is busy / rate-limited)
    3. local Ollama            (only if OLLAMA_FALLBACK=true, or AI_PROVIDER=ollama)

A target is skipped only for temporary problems (rate limit, overload, timeout,
network). Real errors such as a bad API key are raised immediately.
"""
import re
import threading
from dataclasses import dataclass
from typing import Callable, List, Type, TypeVar

from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from app.core.config import settings

T = TypeVar("T", bound=BaseModel)

TRANSIENT = re.compile(
    r"\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|rate.?limit|quota|overloaded|high demand|"
    r"timed? ?out|timeout|connection|temporarily",
    re.I,
)

_used = threading.local()


class AIUnavailable(RuntimeError):
    """Every model in the chain failed."""


@dataclass(frozen=True)
class Target:
    provider: str  # "gemini" | "ollama"
    model: str

    @property
    def label(self) -> str:
        return f"{self.model} ({'Gemini' if self.provider == 'gemini' else 'Ollama'})"


def targets() -> List[Target]:
    if settings.AI_PROVIDER.lower() == "ollama":
        return [Target("ollama", settings.OLLAMA_MODEL)]
    chain = [Target("gemini", settings.GEMINI_MODEL)]
    if settings.GEMINI_FALLBACK_MODEL and settings.GEMINI_FALLBACK_MODEL != settings.GEMINI_MODEL:
        chain.append(Target("gemini", settings.GEMINI_FALLBACK_MODEL))
    if settings.OLLAMA_FALLBACK:
        chain.append(Target("ollama", settings.OLLAMA_MODEL))
    return chain


def is_transient(error: Exception) -> bool:
    return bool(TRANSIENT.search(f"{type(error).__name__} {error}"))


def model_label() -> str:
    """Name of the main model."""
    return targets()[0].label


def used_label() -> str:
    """Model that actually answered the last call on this thread (it may be a fallback)."""
    return getattr(_used, "label", None) or model_label()


def reset_used():
    _used.label = None


def chat_model(target: Target, temperature: float = 0.2):
    """LangChain chat model for a target."""
    if target.provider == "gemini":
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set in backend/.env")
        from langchain_google_genai import ChatGoogleGenerativeAI
        # Gemini 3.x uses fixed sampling, so temperature is not passed
        return ChatGoogleGenerativeAI(model=target.model, google_api_key=settings.GEMINI_API_KEY,
                                      max_retries=2, timeout=settings.AI_TIMEOUT_SECONDS)
    from langchain_ollama import ChatOllama
    return ChatOllama(model=target.model, base_url=settings.OLLAMA_BASE_URL, temperature=temperature,
                      num_ctx=settings.OLLAMA_NUM_CTX)


def crew_llm(target: Target, temperature: float = 0.4):
    """CrewAI LLM for a target (used by the multi-agent crews)."""
    from crewai import LLM
    if target.provider == "gemini":
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set in backend/.env")
        return LLM(model=f"gemini/{target.model}", api_key=settings.GEMINI_API_KEY)
    return LLM(model=f"ollama/{target.model}", base_url=settings.OLLAMA_BASE_URL, temperature=temperature)


def with_fallback(call: Callable[[Target], T]) -> T:
    """Run `call` on each target until one succeeds. Only temporary errors move to the next target."""
    errors = []
    for target in targets():
        try:
            result = call(target)
            _used.label = target.label
            return result
        except Exception as e:
            if not is_transient(e):
                raise
            errors.append(f"{target.label}: {str(e)[:200]}")
    raise AIUnavailable("All AI models are busy or unreachable. " + " | ".join(errors))


def ask(prompt: str, temperature: float = 0.2) -> str:
    """Send one prompt and return the reply text."""
    def call(target: Target) -> str:
        content = chat_model(target, temperature).invoke([HumanMessage(content=prompt)]).content
        if isinstance(content, list):  # Gemini can return content parts
            content = "".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in content)
        return content
    return with_fallback(call)


def structured_invoke(schema: Type[T], prompt: str, retries: int = 1) -> T:
    """
    Ask for a reply that matches `schema` (a Pydantic model). The provider constrains
    the output to the JSON schema; a malformed reply is retried on the same model.
    """
    def call(target: Target) -> T:
        llm = chat_model(target, temperature=0).with_structured_output(schema)
        last: Exception | None = None
        for _ in range(retries + 1):
            try:
                result = llm.invoke([HumanMessage(content=prompt)])
                if result is None:
                    raise ValueError("Model returned no structured output")
                return result
            except Exception as e:
                if is_transient(e):
                    raise
                last = e
        raise RuntimeError(f"{target.label} did not return valid structured output: {last}")
    return with_fallback(call)
