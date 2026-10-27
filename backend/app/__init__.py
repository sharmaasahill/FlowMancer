"""
FlowMancer application package.
"""
import os

# Keep CrewAI and Chroma from sending anonymous usage telemetry.
os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")
