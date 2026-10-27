"""
Lead qualification: prompts for quick mode and the 4-agent crew.
"""
from typing import Dict, List

from app.agents.base import CrewStep

SCORING_GUIDE = """Score each category by picking EXACTLY one of the listed values (we sell AI workflow automation for sales and operations teams):
- company_size: 25 = large or well-known company, or a team of 100+ mentioned | 15 = mid-size | 8 = small | 0 = unknown
- industry_fit: 20 = B2B company with sales/support/ops teams | 10 = partial fit | 0 = poor fit or unknown
- budget: 20 = budget approved | 10 = budget being discussed | 0 = not mentioned
- urgency: 15 = this month or quarter | 8 = this year | 0 = no timeline
- decision_maker: 10 = contact leads or owns the purchase | 5 = unclear | 0 = clearly not a decision maker
- intent: 10 = specific need described | 5 = general interest | 0 = just browsing
The total decides the level: 80+ High, 50-79 Medium, below 50 Low.
Routing: Enterprise sales for large companies, Mid-market or SMB sales by size, Partnerships ONLY for reseller or
integration proposals, Nurture for weak leads."""


def describe_lead(lead: Dict) -> str:
    return "\n".join(
        f"{label}: {lead.get(key) or 'N/A'}"
        for label, key in (("Name", "name"), ("Email", "email"), ("Company", "company"),
                           ("Phone", "phone"), ("Source", "source"), ("Message", "message"))
    )


def quick_prompt(lead: Dict, research: str, knowledge: str | None) -> str:
    parts = [
        "You are a B2B lead qualification expert. Assess this inbound lead.",
        f"Lead:\n{describe_lead(lead)}",
        research,
    ]
    if knowledge:
        parts.append(knowledge)
    has_research = research.startswith("Research findings")
    parts += [
        SCORING_GUIDE,
        ("Start by writing company_summary from the research findings above, then score the lead using "
         "what the research shows about the company's size and industry."
         if has_research else
         "There is no research, so leave company_summary empty and score only on what the lead wrote."),
        "Never state company facts that are not in the research findings.",
    ]
    return "\n\n".join(parts)


def crew_steps(lead: Dict, research: str, knowledge: str | None) -> List[CrewStep]:
    kb = f"\n\n{knowledge}" if knowledge else ""
    return [
        CrewStep(
            name="Lead Analyzer",
            role="Lead Analyzer",
            goal="Extract the key buying signals from an inbound lead",
            backstory="You have years of B2B sales experience and spot buying signals fast.",
            description=(
                f"Analyze this lead and list: company and industry, stated needs, budget indicators, "
                f"timeline/urgency, red flags.\n\nLead:\n{describe_lead(lead)}"
            ),
            expected_output="A short bullet list of extracted signals",
        ),
        CrewStep(
            name="Research Specialist",
            role="Research Specialist",
            goal="Summarize what the real research says about the lead's company",
            backstory="You verify facts and always cite your sources.",
            description=(
                "Summarize what the research below says about the company: what it does, size, "
                "industry, recent news. Cite source URLs. If research is empty, say the company "
                f"could not be verified.\n\n{research}{kb}"
            ),
            expected_output="A sourced company summary, or a statement that nothing was found",
        ),
        CrewStep(
            name="Scoring Expert",
            role="Lead Scoring Expert",
            goal="Score the lead consistently using the scoring guide",
            backstory="You are data-driven and apply the same rubric to every lead.",
            description=f"Using the analysis and research so far, score this lead.\n\n{SCORING_GUIDE}\n\n"
                        "Give the points for each category with a one-line reason.",
            expected_output="Points per category, total score (0-100) and level",
        ),
        CrewStep(
            name="Routing Manager",
            role="Lead Routing Manager",
            goal="Decide who owns the lead and what happens next",
            backstory="You run sales operations and match leads to the right team.",
            description=(
                "Based on the score, decide: owning team, priority (urgent/high/medium/low), the next "
                "action, 2-4 talking points for the rep, and the follow-up timeline."
            ),
            expected_output="Routing decision with team, priority, next action and talking points",
        ),
    ]


def structure_prompt(lead: Dict, research: str, crew_outputs: List[str]) -> str:
    work = "\n\n".join(f"--- {name} ---\n{out}" for name, out in
                       zip(["Analyzer", "Research", "Scoring", "Routing"], crew_outputs))
    return (
        "Convert the sales team's analysis below into the required structured result. "
        "Keep the category points and routing they decided. company_summary must only use facts from the research.\n\n"
        f"{SCORING_GUIDE}\n\n"
        f"Lead:\n{describe_lead(lead)}\n\n{research}\n\nTeam analysis:\n{work}"
    )
