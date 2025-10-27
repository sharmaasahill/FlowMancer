"""
Base Agent Configuration
Defines common tools and utilities for all agents
"""
from typing import List, Any, Optional
from langchain.tools import Tool
from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor
from app.core.config import settings


class BaseAgentConfig:
    """Base configuration for all agents"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-3.5-turbo",
            temperature=0.7,
            openai_api_key=settings.OPENAI_API_KEY
        )
    
    @staticmethod
    def create_tool(name: str, func: callable, description: str) -> Tool:
        """
        Helper method to create a LangChain tool
        """
        return Tool(
            name=name,
            func=func,
            description=description
        )


class AgentTools:
    """
    Collection of tools that agents can use
    """
    
    @staticmethod
    def web_search(query: str) -> str:
        """
        Simulate web search (in production, use SerpAPI or similar)
        """
        return f"Web search results for: {query}"
    
    @staticmethod
    def company_research(company_name: str) -> dict:
        """
        Research company information
        """
        # In production, integrate with Clearbit, Apollo, etc.
        return {
            "company": company_name,
            "industry": "Technology",
            "size": "50-100 employees",
            "revenue": "$5-10M",
            "location": "San Francisco, CA"
        }
    
    @staticmethod
    def send_email(to: str, subject: str, body: str) -> dict:
        """
        Send email (simulated - integrate with SendGrid/Resend in production)
        """
        print(f"📧 Sending email to {to}: {subject}")
        return {
            "status": "sent",
            "to": to,
            "subject": subject,
            "message_id": "msg_123456"
        }
    
    @staticmethod
    def update_crm(data: dict) -> dict:
        """
        Update CRM system (simulated - integrate with HubSpot/Salesforce in production)
        """
        print(f"📊 Updating CRM with data: {data}")
        return {
            "status": "updated",
            "record_id": "crm_123456",
            "data": data
        }
    
    @staticmethod
    def send_slack_message(channel: str, message: str) -> dict:
        """
        Send Slack notification
        """
        print(f"💬 Slack notification to {channel}: {message}")
        return {
            "status": "sent",
            "channel": channel,
            "timestamp": "1234567890.123456"
        }
    
    @staticmethod
    def extract_text_from_document(file_path: str) -> str:
        """
        Extract text from document (PDF, DOCX, etc.)
        """
        # In production, use PyPDF2, python-docx, etc.
        return "Sample extracted text from document"
    
    @staticmethod
    def validate_data(data: dict, rules: dict) -> dict:
        """
        Validate data against business rules
        """
        errors = []
        # Simple validation logic
        for field, rule in rules.items():
            if field not in data:
                errors.append(f"Missing required field: {field}")
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors
        }

