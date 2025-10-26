"""
Agents module initialization
"""
from app.agents.lead_agents import LeadQualificationCrew, QuickLeadScorer
from app.agents.email_agents import EmailProcessingCrew, QuickEmailProcessor
from app.agents.document_agents import DocumentProcessingCrew, QuickDocumentProcessor

__all__ = [
    "LeadQualificationCrew",
    "QuickLeadScorer",
    "EmailProcessingCrew",
    "QuickEmailProcessor",
    "DocumentProcessingCrew",
    "QuickDocumentProcessor",
]

