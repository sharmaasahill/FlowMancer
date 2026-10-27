"""
Sanity check: settings load and the AI model answers.
Run from backend/:  venv/Scripts/python.exe check_setup.py
"""
import sys

try:
    from app.core import llm
except Exception as e:
    sys.exit(f"[FAIL] Could not load settings: {e}")

chain = [t.label for t in llm.targets()]
print(f"[OK] Settings loaded. Models: {' -> '.join(chain)}")

try:
    reply = llm.ask("Reply with exactly: FlowMancer is ready")
except Exception as e:
    sys.exit(f"[FAIL] AI call failed: {e}\n"
             "       Gemini: check GEMINI_API_KEY in backend/.env. Ollama: is the app running and the model pulled?")

print(f"[OK] {llm.used_label()} replied: {reply.strip()[:80]}")
