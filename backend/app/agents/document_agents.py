"""
AI Agents for Document Processing Workflow
"""
from crewai import Agent, Task, Crew
from langchain_openai import ChatOpenAI
from app.core.config import settings
from typing import Dict, Any


class DocumentProcessingCrew:
    """
    Multi-agent system for intelligent document processing
    """
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4",
            temperature=0.7,
            openai_api_key=settings.OPENAI_API_KEY
        )
    
    def create_agents(self):
        """Create specialized agents for document processing"""
        
        # Agent 1: Document Classifier
        document_classifier = Agent(
            role="Document Classifier",
            goal="Identify document type and extract key metadata",
            backstory="""You are an expert at recognizing different types of business documents. 
            You can quickly identify invoices, contracts, receipts, purchase orders, and more. 
            You understand document structure and know what information is important.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
        
        # Agent 2: Data Extractor
        data_extractor = Agent(
            role="Data Extraction Specialist",
            goal="Extract structured data from documents with high accuracy",
            backstory="""You are a data extraction expert who excels at pulling structured information 
            from unstructured documents. You can find dates, amounts, company names, line items, 
            and other key data points even when documents are poorly formatted.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
        
        # Agent 3: Validator
        validator = Agent(
            role="Document Validator",
            goal="Validate extracted data against business rules and identify errors",
            backstory="""You are a quality control expert who ensures data accuracy. You check for 
            consistency, validate calculations, verify required fields, and flag potential errors. 
            You prevent costly mistakes before they enter systems.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
        
        # Agent 4: Workflow Router
        workflow_router = Agent(
            role="Workflow Router",
            goal="Determine approval requirements and next steps for document processing",
            backstory="""You are a process expert who knows the approval chains and routing rules. 
            You understand which documents need executive approval, which can be auto-processed, 
            and what happens when validation fails.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
        
        return document_classifier, data_extractor, validator, workflow_router
    
    def create_tasks(self, document_data: Dict[str, Any], agents: tuple):
        """Create tasks for the document processing workflow"""
        
        document_classifier, data_extractor, validator, workflow_router = agents
        
        # Task 1: Classify Document
        classify_task = Task(
            description=f"""Classify this document:
            
            Document Type: {document_data.get('document_type', 'Unknown')}
            Content Sample: {document_data.get('file_content', 'N/A')[:500]}
            
            Identify:
            - Exact document type (invoice/receipt/contract/PO/other)
            - Document sub-category
            - Confidence level of classification
            - Document quality (good/poor/needs_review)
            
            Provide detailed classification.""",
            agent=document_classifier,
            expected_output="Document classification with type, confidence, and quality assessment"
        )
        
        # Task 2: Extract Data
        extract_task = Task(
            description="""Extract all relevant data from this document:
            
            For Invoices extract:
            - Invoice number, date, due date
            - Vendor name and address
            - Line items (description, quantity, price)
            - Subtotal, tax, total amount
            - Payment terms
            
            For Contracts extract:
            - Contract number, effective date, expiration date
            - Parties involved
            - Key terms and obligations
            - Payment terms
            - Renewal clauses
            
            For Receipts extract:
            - Date, merchant name
            - Items purchased
            - Total amount, payment method
            - Tax information
            
            Provide structured extracted data.""",
            agent=data_extractor,
            expected_output="Structured data extracted from document with all key fields"
        )
        
        # Task 3: Validate Data
        validate_task = Task(
            description="""Validate the extracted data:
            
            Check:
            - Required fields are present
            - Dates are valid and in correct format
            - Amounts are calculated correctly
            - Company names match known vendors
            - No obvious errors or inconsistencies
            
            Flag:
            - Missing required fields
            - Calculation errors
            - Unusual amounts or patterns
            - Data quality issues
            
            Provide validation report with status and any errors.""",
            agent=validator,
            expected_output="Validation report with status (valid/invalid/needs_review) and list of any errors"
        )
        
        # Task 4: Route Document
        routing_task = Task(
            description="""Based on the document type and validation results:
            
            Determine:
            1. Does this need approval? (yes/no)
            2. Who should approve it? (finance/executive/auto-approve)
            3. What's the approval threshold? (amount-based rules)
            4. What system should this be entered into? (accounting/ERP/archive)
            5. What are the next steps?
            6. Any notifications needed?
            
            Create a complete routing and action plan.""",
            agent=workflow_router,
            expected_output="Complete routing decision with approvals, system updates, and next steps"
        )
        
        return [classify_task, extract_task, validate_task, routing_task]
    
    def process_document(self, document_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a document through the multi-agent workflow
        """
        try:
            # Create agents and tasks
            agents = self.create_agents()
            tasks = self.create_tasks(document_data, agents)
            
            # Create crew and execute
            crew = Crew(
                agents=list(agents),
                tasks=tasks,
                verbose=True
            )
            
            # Execute the crew workflow
            result = crew.kickoff()
            
            # Parse and structure the results
            return {
                "status": "completed",
                "document_data": document_data,
                "processing_result": str(result),
                "agents_involved": [agent.role for agent in agents],
                "tasks_completed": len(tasks)
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e),
                "document_data": document_data
            }


# Simplified version for quick document processing
class QuickDocumentProcessor:
    """
    Simplified document processor for faster processing
    """
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4",
            temperature=0.7,
            openai_api_key=settings.OPENAI_API_KEY
        )
    
    def process_document(self, document_data: Dict[str, Any]) -> Dict[str, Any]:
        """Quick document processing using single LLM call"""
        
        prompt = f"""You are a document processing expert. Analyze this document and provide a structured response.

Document:
Type: {document_data.get('document_type', 'Unknown')}
Content: {document_data.get('file_content', 'N/A')[:1000]}

Provide a JSON response with:
1. document_type (invoice/contract/receipt/other)
2. extracted_data (key-value pairs of extracted information)
3. validation_status (valid/invalid/needs_review)
4. validation_errors (array of issues found)
5. approval_required (bool)
6. next_steps (array of actions)

Response format:
{{
    "document_type": "invoice",
    "extracted_data": {{
        "invoice_number": "INV-001",
        "date": "2024-01-15",
        "vendor": "Acme Corp",
        "total_amount": 1500.00
    }},
    "validation_status": "valid",
    "validation_errors": [],
    "approval_required": true,
    "next_steps": ["send_for_approval", "update_accounting_system"]
}}
"""
        
        try:
            response = self.llm.invoke(prompt)
            return {
                "status": "completed",
                "document_data": document_data,
                "result": response.content
            }
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e)
            }

