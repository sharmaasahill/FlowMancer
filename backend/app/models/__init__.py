"""
Models module initialization
"""
from app.models.workflow import (AICall, AppState, Approval, Connection, KnowledgeDocument, Run, User, Workflow,
                                 WorkflowExecution)

# Tables whose rows belong to one account (cleared when an account is deleted or the demo is reset)
OWNED_MODELS = (Workflow, WorkflowExecution, Run, Approval, KnowledgeDocument, AICall, Connection)

__all__ = ["User", "Workflow", "WorkflowExecution", "Run", "Approval", "KnowledgeDocument", "AICall", "Connection",
           "AppState", "OWNED_MODELS"]
