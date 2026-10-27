"""
Models module initialization
"""
from app.models.workflow import Approval, KnowledgeDocument, Run, User, Workflow, WorkflowExecution

OWNED_MODELS = (Workflow, WorkflowExecution, Run, Approval, KnowledgeDocument)

__all__ = ["User", "Workflow", "WorkflowExecution", "Run", "Approval", "KnowledgeDocument", "OWNED_MODELS"]
