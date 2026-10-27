"""
Quick sanity check: config loads and the configured LLM answers.
Run from backend/:  python test_setup.py
"""
import sys

try:
    from app.core.config import settings
    from app.core.llm import ask, model_label
except Exception as e:
    sys.exit(f"[FAIL] Could not load config: {e}")

print(f"[OK] Config loaded. Provider: {model_label()}")

try:
    reply = ask("Reply with exactly: FlowMancer is ready", temperature=0)
except Exception as e:
    hint = (f"Is Ollama running and is '{settings.OLLAMA_MODEL}' pulled? "
            f"Try: ollama pull {settings.OLLAMA_MODEL}"
            if settings.AI_PROVIDER == "ollama" else "Check OPENAI_API_KEY and billing.")
    sys.exit(f"[FAIL] LLM call failed: {e}\n       {hint}")

print(f"[OK] LLM replied: {reply.strip()[:80]}")
