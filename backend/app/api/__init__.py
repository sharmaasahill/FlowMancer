"""
API routes initialization
"""
from app.api import (approvals, assistant, auth, connections, executions, knowledge, runs, system, triggers, usage,
                     use_cases, workflows)

__all__ = ["approvals", "assistant", "auth", "connections", "executions", "knowledge", "runs", "system", "triggers",
           "usage", "use_cases", "workflows"]
