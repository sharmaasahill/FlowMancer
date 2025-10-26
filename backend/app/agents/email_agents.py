"""
AI Agents for Email Processing Workflow
"""
from crewai import Agent, Task, Crew
from langchain_openai import ChatOpenAI
from app.core.config import settings
from typing import Dict, Any


class EmailProcessingCrew:
    """
    Multi-agent system for intelligent email processing and response
    """
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4",
            temperature=0.7,
            openai_api_key=settings.OPENAI_API_KEY
        )
    
    def create_agents(self):
        """Create specialized agents for email processing"""
        
        # Agent 1: Email Classifier
        email_classifier = Agent(
            role="Email Classifier",
            goal="Categorize incoming emails and determine their priority and intent",
            backstory="""You are an expert at triaging business emails. You can quickly identify 
            whether an email is a support request, sales inquiry, partnership opportunity, or spam. 
            You understand urgency levels and can spot VIP senders.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
        
        # Agent 2: Sentiment Analyzer
        sentiment_analyzer = Agent(
            role="Sentiment Analyzer",
            goal="Analyze the emotional tone and urgency of emails",
            backstory="""You are a communication expert who excels at reading between the lines. 
            You can detect frustration, satisfaction, urgency, or casual inquiry from email content. 
            Your analysis helps prioritize responses and choose appropriate tone.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
        
        # Agent 3: Response Drafter
        response_drafter = Agent(
            role="Response Drafter",
            goal="Create professional, contextually appropriate email responses",
            backstory="""You are a master of business communication. You write clear, professional, 
            and empathetic email responses that address the sender's needs. You adapt your tone 
            based on the situation and always maintain brand voice.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
        
        # Agent 4: Action Coordinator
        action_coordinator = Agent(
            role="Action Coordinator",
            goal="Determine required actions and route emails to appropriate team members",
            backstory="""You are an operations expert who knows exactly what actions each email requires. 
            You can identify when to escalate, who should handle what, and what follow-up is needed. 
            You ensure nothing falls through the cracks.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
        
        return email_classifier, sentiment_analyzer, response_drafter, action_coordinator
    
    def create_tasks(self, email_data: Dict[str, Any], agents: tuple):
        """Create tasks for the email processing workflow"""
        
        email_classifier, sentiment_analyzer, response_drafter, action_coordinator = agents
        
        # Task 1: Classify Email
        classify_task = Task(
            description=f"""Classify this email:
            
            From: {email_data.get('from_email', 'Unknown')}
            Subject: {email_data.get('subject', 'No Subject')}
            Body: {email_data.get('body', '')}
            
            Determine:
            - Category (support/sales/partnership/spam/other)
            - Sub-category if applicable
            - Keywords and tags
            - Whether it's auto-generated or human-written
            
            Provide detailed classification.""",
            agent=email_classifier,
            expected_output="Email category, tags, and classification details"
        )
        
        # Task 2: Analyze Sentiment and Priority
        sentiment_task = Task(
            description="""Analyze the sentiment and urgency of this email:
            
            Assess:
            - Sentiment (positive/neutral/negative)
            - Urgency level (urgent/high/medium/low)
            - Emotional tone (frustrated/satisfied/curious/angry/neutral)
            - VIP status (based on sender and content)
            
            Provide sentiment analysis and priority recommendation.""",
            agent=sentiment_analyzer,
            expected_output="Sentiment analysis with urgency level and emotional tone assessment"
        )
        
        # Task 3: Draft Response
        draft_task = Task(
            description="""Based on the email classification and sentiment:
            
            Draft an appropriate response:
            - Use professional and empathetic tone
            - Address the sender's key concerns or questions
            - Provide helpful information or next steps
            - Match the urgency level
            - Keep it concise but complete
            
            Create a draft response ready for review or sending.""",
            agent=response_drafter,
            expected_output="Professional draft email response ready for review"
        )
        
        # Task 4: Coordinate Actions
        action_task = Task(
            description="""Determine required actions for this email:
            
            Decide:
            1. Who should this be assigned to? (support team/sales/partnerships)
            2. What actions are required? (respond/escalate/add to CRM/schedule call)
            3. What's the timeline for response?
            4. Should this trigger any workflows?
            5. What knowledge base articles are relevant?
            
            Create a complete action plan.""",
            agent=action_coordinator,
            expected_output="Complete action plan with assignments, timeline, and follow-up tasks"
        )
        
        return [classify_task, sentiment_task, draft_task, action_task]
    
    def process_email(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process an email through the multi-agent workflow
        """
        try:
            # Create agents and tasks
            agents = self.create_agents()
            tasks = self.create_tasks(email_data, agents)
            
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
                "email_data": email_data,
                "processing_result": str(result),
                "agents_involved": [agent.role for agent in agents],
                "tasks_completed": len(tasks)
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e),
                "email_data": email_data
            }


# Simplified version for quick email processing
class QuickEmailProcessor:
    """
    Simplified email processor for faster processing
    """
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4",
            temperature=0.7,
            openai_api_key=settings.OPENAI_API_KEY
        )
    
    def process_email(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Quick email processing using single LLM call"""
        
        prompt = f"""You are an email processing expert. Analyze this email and provide a structured response.

Email:
From: {email_data.get('from_email', 'Unknown')}
Subject: {email_data.get('subject', 'No Subject')}
Body: {email_data.get('body', '')}

Provide a JSON response with:
1. category (support/sales/partnership/spam)
2. priority (urgent/high/medium/low)
3. sentiment (positive/neutral/negative)
4. draft_response (professional email reply)
5. action_required (bool)
6. assigned_to (which team)
7. tags (array of relevant tags)

Response format:
{{
    "category": "support",
    "priority": "high",
    "sentiment": "negative",
    "draft_response": "Dear [Name], Thank you for reaching out...",
    "action_required": true,
    "assigned_to": "support_team",
    "tags": ["technical_issue", "urgent"]
}}
"""
        
        try:
            response = self.llm.invoke(prompt)
            return {
                "status": "completed",
                "email_data": email_data,
                "result": response.content
            }
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e)
            }

