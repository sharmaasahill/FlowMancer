"""
n8n Integration Module
Allows FlowMancer to trigger and interact with n8n workflows
"""
import httpx
from typing import Dict, Any, Optional
from app.core.config import settings


class N8nIntegration:
    """
    Integration with n8n automation platform
    """
    
    def __init__(self):
        self.api_url = settings.N8N_API_URL
        self.api_key = settings.N8N_API_KEY
        self.headers = {
            "X-N8N-API-KEY": self.api_key,
            "Content-Type": "application/json"
        }
    
    async def trigger_workflow(
        self,
        workflow_id: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Trigger an n8n workflow with data
        
        Args:
            workflow_id: The n8n workflow ID
            data: Data to pass to the workflow
            
        Returns:
            Response from n8n
        """
        if not self.api_key or not self.api_url:
            return {
                "status": "skipped",
                "message": "n8n integration not configured"
            }
        
        try:
            async with httpx.AsyncClient() as client:
                url = f"{self.api_url}/workflows/{workflow_id}/execute"
                response = await client.post(
                    url,
                    headers=self.headers,
                    json={"data": data}
                )
                response.raise_for_status()
                
                return {
                    "status": "success",
                    "execution_id": response.json().get("executionId"),
                    "data": response.json()
                }
                
        except httpx.HTTPError as e:
            return {
                "status": "error",
                "message": f"Failed to trigger n8n workflow: {str(e)}"
            }
    
    async def get_workflow_status(self, execution_id: str) -> Dict[str, Any]:
        """
        Check the status of a workflow execution
        
        Args:
            execution_id: The n8n execution ID
            
        Returns:
            Execution status
        """
        if not self.api_key or not self.api_url:
            return {"status": "skipped"}
        
        try:
            async with httpx.AsyncClient() as client:
                url = f"{self.api_url}/executions/{execution_id}"
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                
                return response.json()
                
        except httpx.HTTPError as e:
            return {
                "status": "error",
                "message": f"Failed to get execution status: {str(e)}"
            }
    
    async def list_workflows(self) -> Dict[str, Any]:
        """
        List all available n8n workflows
        
        Returns:
            List of workflows
        """
        if not self.api_key or not self.api_url:
            return {"status": "skipped", "workflows": []}
        
        try:
            async with httpx.AsyncClient() as client:
                url = f"{self.api_url}/workflows"
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                
                return {
                    "status": "success",
                    "workflows": response.json()
                }
                
        except httpx.HTTPError as e:
            return {
                "status": "error",
                "message": f"Failed to list workflows: {str(e)}",
                "workflows": []
            }
    
    def handle_webhook(self, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle incoming webhook from n8n
        
        Args:
            webhook_data: Data from n8n webhook
            
        Returns:
            Processing result
        """
        # Process the webhook data
        # This can trigger FlowMancer workflows based on n8n events
        
        return {
            "status": "received",
            "message": "Webhook processed successfully",
            "data": webhook_data
        }

