"""
AI Agents for Lead Qualification Workflow
"""
from crewai import Agent, Task, Crew
from langchain_openai import ChatOpenAI
from app.core.config import settings
from typing import Dict, Any


class LeadQualificationCrew:
    """
    Multi-agent system for intelligent lead qualification
    """
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4",
            temperature=0.7,
            openai_api_key=settings.OPENAI_API_KEY
        )
    
    def create_agents(self):
        """Create specialized agents for lead qualification"""
        
        # Agent 1: Lead Analyzer
        lead_analyzer = Agent(
            role="Lead Analyzer",
            goal="Analyze incoming leads to extract key information and assess initial quality",
            backstory="""You are an expert at analyzing business leads. You can quickly identify 
            key signals like company size, industry, budget indicators, and urgency from limited information. 
            You have years of experience in B2B sales and know what makes a high-quality lead.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
        
        # Agent 2: Research Specialist
        research_specialist = Agent(
            role="Research Specialist",
            goal="Enrich lead data by finding additional company and contact information",
            backstory="""You are a research expert who excels at finding company information online. 
            You use various data sources to discover company size, revenue, recent news, technology stack, 
            and decision-maker contacts. You always provide accurate and up-to-date information.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
        
        # Agent 3: Scoring Expert
        scoring_expert = Agent(
            role="Lead Scoring Expert",
            goal="Score leads based on multiple factors and assign qualification level",
            backstory="""You are a data-driven lead scoring specialist. You evaluate leads based on 
            firmographic data, behavioral signals, intent indicators, and fit with ideal customer profile. 
            Your scoring methodology has been proven to increase conversion rates by 40%.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
        
        # Agent 4: Routing Manager
        routing_manager = Agent(
            role="Lead Routing Manager",
            goal="Determine the best sales representative and next action for each lead",
            backstory="""You are an operations expert who knows the sales team intimately. You understand 
            each rep's strengths, current workload, industry expertise, and territory. You ensure leads 
            are routed to the right person at the right time for maximum conversion.""",
            llm=self.llm,
            verbose=True,
            allow_delegation=False
        )
        
        return lead_analyzer, research_specialist, scoring_expert, routing_manager
    
    def create_tasks(self, lead_data: Dict[str, Any], agents: tuple):
        """Create tasks for the lead qualification workflow"""
        
        lead_analyzer, research_specialist, scoring_expert, routing_manager = agents
        
        # Task 1: Analyze Lead
        analyze_task = Task(
            description=f"""Analyze the following lead information and extract key insights:
            
            Lead Data: {lead_data}
            
            Extract:
            - Company name and industry
            - Contact details
            - Expressed needs or pain points
            - Budget indicators
            - Timeline/urgency signals
            - Any red flags
            
            Provide a structured analysis of this lead.""",
            agent=lead_analyzer,
            expected_output="A structured analysis with extracted key information and initial assessment"
        )
        
        # Task 2: Research and Enrich
        research_task = Task(
            description="""Based on the lead analysis, research and enrich the lead data:
            
            Find:
            - Company size and employee count
            - Annual revenue (if publicly available)
            - Recent company news or funding
            - Technology stack they use
            - Key decision makers
            - Social media presence
            
            Provide enriched data that helps qualify this lead.""",
            agent=research_specialist,
            expected_output="Enriched lead data with company information and key insights"
        )
        
        # Task 3: Score and Qualify
        scoring_task = Task(
            description="""Score this lead based on all available information:
            
            Scoring Criteria (0-100 scale):
            - Company Size & Revenue (0-25 points)
            - Industry Fit (0-20 points)
            - Budget Indicators (0-20 points)
            - Urgency/Timeline (0-15 points)
            - Decision Maker Access (0-10 points)
            - Intent Signals (0-10 points)
            
            Classification:
            - High Quality (80-100): Hot lead, immediate follow-up
            - Medium Quality (50-79): Qualified lead, standard follow-up
            - Low Quality (0-49): Nurture or disqualify
            
            Provide final score, qualification level, and reasoning.""",
            agent=scoring_expert,
            expected_output="Lead score (0-100), qualification level (High/Medium/Low), and detailed reasoning"
        )
        
        # Task 4: Route and Recommend Action
        routing_task = Task(
            description="""Based on the lead score and qualification:
            
            Determine:
            1. Best sales representative to assign (consider expertise, territory, workload)
            2. Recommended next action (call, email, demo, nurture campaign)
            3. Priority level (urgent, high, medium, low)
            4. Suggested talking points for sales rep
            5. Timeline for follow-up
            
            Create a complete action plan for this lead.""",
            agent=routing_manager,
            expected_output="Routing decision with assigned rep, recommended actions, and complete follow-up plan"
        )
        
        return [analyze_task, research_task, scoring_task, routing_task]
    
    def process_lead(self, lead_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a lead through the multi-agent qualification workflow
        """
        try:
            # Create agents and tasks
            agents = self.create_agents()
            tasks = self.create_tasks(lead_data, agents)
            
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
                "lead_data": lead_data,
                "qualification_result": str(result),
                "agents_involved": [agent.role for agent in agents],
                "tasks_completed": len(tasks)
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e),
                "lead_data": lead_data
            }


# Simplified version for quick processing (without full agent orchestration)
class QuickLeadScorer:
    """
    Simplified lead scorer for faster processing
    Uses single LLM call instead of full agent orchestration
    """
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4",
            temperature=0.7,
            openai_api_key=settings.OPENAI_API_KEY
        )
    
    def score_lead(self, lead_data: Dict[str, Any]) -> Dict[str, Any]:
        """Quick lead scoring using single LLM call"""
        
        prompt = f"""You are a lead qualification expert. Analyze this lead and provide a structured assessment.

Lead Information:
{lead_data}

Provide a JSON response with:
1. lead_score (0-100)
2. qualification (High/Medium/Low)
3. reasoning (brief explanation)
4. recommended_action (what should sales do next)
5. priority (urgent/high/medium/low)

Response format:
{{
    "lead_score": 85,
    "qualification": "High",
    "reasoning": "Strong company fit, clear budget, urgent timeline",
    "recommended_action": "Schedule demo call within 24 hours",
    "priority": "urgent"
}}
"""
        
        try:
            response = self.llm.invoke(prompt)
            # In production, parse the JSON response properly
            return {
                "status": "completed",
                "lead_data": lead_data,
                "assessment": response.content
            }
        except Exception as e:
            return {
                "status": "failed",
                "error": str(e)
            }

