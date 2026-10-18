"""
FlowMancer Application Package
"""
import os

# Keep everything local: turn off CrewAI's anonymous usage telemetry.
os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")

__version__ = "1.0.0"
