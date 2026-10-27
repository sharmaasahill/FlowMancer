import pytest

from app.core import llm
from app.core.config import settings


def chain(monkeypatch, **overrides):
    values = {"AI_PROVIDER": "gemini", "GEMINI_MODEL": "main-model", "GEMINI_FALLBACK_MODEL": "backup-model",
              "OLLAMA_FALLBACK": False, "OLLAMA_MODEL": "llama3.2", **overrides}
    for key, value in values.items():
        monkeypatch.setattr(settings, key, value)
    return [t.label for t in llm.targets()]


def test_target_chain(monkeypatch):
    assert chain(monkeypatch) == ["main-model (Gemini)", "backup-model (Gemini)"]
    assert chain(monkeypatch, OLLAMA_FALLBACK=True)[-1] == "llama3.2 (Ollama)"
    assert chain(monkeypatch, GEMINI_FALLBACK_MODEL="") == ["main-model (Gemini)"]
    assert chain(monkeypatch, AI_PROVIDER="ollama") == ["llama3.2 (Ollama)"]


def test_busy_model_falls_back_and_records_which_answered(monkeypatch):
    chain(monkeypatch)
    tried = []

    def call(target):
        tried.append(target.model)
        if target.model == "main-model":
            raise RuntimeError("503 UNAVAILABLE. This model is currently experiencing high demand.")
        return "ok"

    llm.reset_used()
    assert llm.with_fallback(call) == "ok"
    assert tried == ["main-model", "backup-model"]
    assert llm.used_label() == "backup-model (Gemini)"


def test_real_errors_are_not_hidden_by_fallback(monkeypatch):
    chain(monkeypatch)
    tried = []

    def call(target):
        tried.append(target.model)
        raise ValueError("API key not valid")

    with pytest.raises(ValueError, match="API key"):
        llm.with_fallback(call)
    assert tried == ["main-model"]


def test_all_models_busy(monkeypatch):
    chain(monkeypatch)

    def call(target):
        raise RuntimeError("429 RESOURCE_EXHAUSTED: quota exceeded")

    with pytest.raises(llm.AIUnavailable, match="busy or unreachable"):
        llm.with_fallback(call)


@pytest.mark.parametrize("message,expected", [
    ("429 RESOURCE_EXHAUSTED", True),
    ("503 UNAVAILABLE high demand", True),
    ("The read operation timed out", True),
    ("400 INVALID_ARGUMENT: API key not valid", False),
    ("1 validation error for LeadResult", False),
])
def test_transient_detection(message, expected):
    assert llm.is_transient(RuntimeError(message)) is expected


def test_missing_key_gives_clear_error(monkeypatch):
    chain(monkeypatch, GEMINI_API_KEY="")
    with pytest.raises(RuntimeError, match="GEMINI_API_KEY is not set"):
        llm.chat_model(llm.targets()[0])
