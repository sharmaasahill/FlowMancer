"""
Integrations module initialization
"""
from app.integrations.n8n_integration import N8nIntegration
from app.integrations.zapier_integration import ZapierIntegration

__all__ = ["N8nIntegration", "ZapierIntegration"]

