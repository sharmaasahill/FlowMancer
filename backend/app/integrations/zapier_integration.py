"""
Zapier Integration Module
Allows FlowMancer to send data to Zapier via webhooks
"""
import httpx
from typing import Dict, Any
from app.core.config import settings


class ZapierIntegration:
    """
    Integration with Zapier automation platform
    """
    
    def __init__(self):
        self.webhook_url = settings.ZAPIER_WEBHOOK_URL
    
    async def send_to_zapier(
        self,
        data: Dict[str, Any],
        webhook_url: str = None
    ) -> Dict[str, Any]:
        """
        Send data to Zapier via webhook
        
        Args:
            data: Data to send to Zapier
            webhook_url: Optional custom webhook URL (uses default if not provided)
            
        Returns:
            Response from Zapier
        """
        url = webhook_url or self.webhook_url
        
        if not url:
            return {
                "status": "skipped",
                "message": "Zapier webhook URL not configured"
            }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=data,
                    timeout=30.0
                )
                response.raise_for_status()
                
                return {
                    "status": "success",
                    "message": "Data sent to Zapier successfully",
                    "response": response.text
                }
                
        except httpx.HTTPError as e:
            return {
                "status": "error",
                "message": f"Failed to send to Zapier: {str(e)}"
            }
    
    def handle_webhook(self, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle incoming webhook from Zapier
        
        Args:
            webhook_data: Data from Zapier webhook
            
        Returns:
            Processing result
        """
        # Process the webhook data
        # This can trigger FlowMancer workflows based on Zapier events
        
        return {
            "status": "received",
            "message": "Zapier webhook processed successfully",
            "data": webhook_data
        }
    
    async def trigger_zap(
        self,
        event_name: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Trigger a Zapier workflow with a specific event
        
        Args:
            event_name: Name of the event to trigger
            data: Data to pass to the Zap
            
        Returns:
            Response from Zapier
        """
        payload = {
            "event": event_name,
            "data": data,
            "timestamp": "2024-01-01T00:00:00Z"  # Use actual timestamp
        }
        
        return await self.send_to_zapier(payload)

