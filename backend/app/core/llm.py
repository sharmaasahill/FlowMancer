"""
AI model access.

Every AI call goes through a short chain of "targets":
    1. GEMINI_MODEL            (main)
    2. GEMINI_FALLBACK_MODEL   (when the main model is busy / rate-limited)
    3. local Ollama            (only if OLLAMA_FALLBACK=true, or AI_PROVIDER=ollama)

A target is skipped only for temporary problems (rate limit, overload, timeout,
network). Real errors such as a bad API key are raised immediately.

Every attempt (including failed ones) is recorded with its token counts for the
Usage page; see app/services/usage.py.
"""
import logging
import re
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, List, Optional, Type, TypeVar

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
log = logging.getLogger("flowmancer.llm")


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


# ---------------- usage metering ----------------
@dataclass
class Meter:
    """Tokens and requests used by the current attempt."""
    input_tokens: int = 0
    output_tokens: int = 0
    requests: int = 0


def note_tokens(input_tokens: Optional[int] = 0, output_tokens: Optional[int] = 0, requests: int = 1):
    """Add usage to the attempt in progress on this thread (no-op outside with_fallback)."""
    meter: Optional[Meter] = getattr(_used, "meter", None)
    if meter is not None:
        meter.input_tokens += int(input_tokens or 0)
        meter.output_tokens += int(output_tokens or 0)
        meter.requests += int(requests or 0)


def counted(message: Any) -> Any:
    """Record the token counts a LangChain AIMessage reports, and return it unchanged."""
    usage = getattr(message, "usage_metadata", None) or {}
    note_tokens(usage.get("input_tokens"), usage.get("output_tokens"))
    return message


RATE_LIMITED = re.compile(r"\b429\b|RESOURCE_EXHAUSTED|rate.?limit|quota", re.I)
BUSY = re.compile(r"\b(500|502|503|504)\b|UNAVAILABLE|overloaded|high demand", re.I)
TIMED_OUT = re.compile(r"timed? ?out|timeout", re.I)


def outcome_of(error: Optional[Exception]) -> str:
    if error is None:
        return "ok"
    text = f"{type(error).__name__} {error}"
    for name, pattern in (("rate_limited", RATE_LIMITED), ("busy", BUSY), ("timeout", TIMED_OUT)):
        if pattern.search(text):
            return name
    return "error"


def _record(target: Target, fallback: bool, meter: Meter, seconds: float, error: Optional[Exception]):
    try:
        from app.services import usage  # late import: usage depends on the database layer
        usage.record_attempt(provider=target.provider, model=target.model, fallback=fallback,
                             status=outcome_of(error), error=str(error)[:300] if error else None,
                             seconds=round(seconds, 2), input_tokens=meter.input_tokens,
                             output_tokens=meter.output_tokens, requests=max(1, meter.requests))
    except Exception:  # usage tracking must never break an AI call
        log.warning("Could not record AI usage", exc_info=True)


def with_fallback(call: Callable[[Target], T]) -> T:
    """Run `call` on each target until one succeeds. Only temporary errors move to the next target."""
    errors = []
    for position, target in enumerate(targets()):
        meter = _used.meter = Meter()
        started = time.monotonic()
        try:
            result = call(target)
        except Exception as e:
            _record(target, position > 0, meter, time.monotonic() - started, e)
            if not is_transient(e):
                raise
            errors.append(f"{target.label}: {str(e)[:200]}")
            continue
        finally:
            _used.meter = None
        _record(target, position > 0, meter, time.monotonic() - started, None)
        _used.label = target.label
        return result
    raise AIUnavailable("All AI models are busy or unreachable. " + " | ".join(errors))


def text_of(content) -> str:
    """Message content as plain text (Gemini can return a list of content parts)."""
    if isinstance(content, list):
        return "".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in content)
    return content or ""


def ask(prompt: str, temperature: float = 0.2) -> str:
    """Send one prompt and return the reply text."""
    return with_fallback(lambda t: text_of(counted(chat_model(t, temperature).invoke([HumanMessage(content=prompt)])).content))


def structured_invoke(schema: Type[T], prompt: str, retries: int = 1) -> T:
    """
    Ask for a reply that matches `schema` (a Pydantic model). The provider constrains
    the output to the JSON schema; a malformed reply is retried on the same model.
    """
    def call(target: Target) -> T:
        # include_raw keeps the raw message, which carries the token counts
        llm = chat_model(target, temperature=0).with_structured_output(schema, include_raw=True)
        last: Exception | None = None
        for _ in range(retries + 1):
            try:
                out = llm.invoke([HumanMessage(content=prompt)])
                counted(out.get("raw"))
                result = out.get("parsed")
                if result is None:
                    raise ValueError(out.get("parsing_error") or "Model returned no structured output")
                return result
            except Exception as e:
                if is_transient(e):
                    raise
                last = e
        raise RuntimeError(f"{target.label} did not return valid structured output: {last}")
    return with_fallback(call)
