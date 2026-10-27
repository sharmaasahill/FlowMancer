"""
Email processing: prompts for quick mode and the 4-agent crew.
"""
from typing import Dict, List

from app.agents.base import CrewStep

CATEGORY_GUIDE = """Categories:
- support: a customer has a problem or question about using the product
- billing: payments, invoices, refunds, cancellations, plan changes
- sales: someone interested in buying or upgrading
- partnership: proposals to collaborate, integrate or resell
- spam: unsolicited mass marketing, scams, phishing, SEO/link offers. A real person asking for help, a refund or information is NEVER spam.
- other: anything else
Priority: urgent = service down, security issue, or the sender says it is urgent; high = blocked customer or money at stake;
medium = normal request; low = no action needed."""

REPLY_RULES = (
    "Reply rules: be polite and specific, answer what the sender asked, keep it under 150 words, "
    "sign off as 'The Support Team'. Use the company knowledge base for policies, prices and facts, "
    "and apply them correctly to the sender's situation (check dates and numbers). If the knowledge base "
    "doesn't cover the question, promise a follow-up instead of inventing an answer."
)


def describe_email(email: Dict) -> str:
    return (
        f"From: {email.get('from_email', 'unknown')}\n"
        f"Subject: {email.get('subject', '(no subject)')}\n"
        f"Body:\n{(email.get('body') or '')[:8000]}"
    )


def quick_prompt(email: Dict, knowledge: str | None) -> str:
    parts = ["You are an expert at triaging a company's inbox. Analyze this email.", describe_email(email),
             CATEGORY_GUIDE]
    parts.append(knowledge or "Company knowledge base: no relevant entries.")
    parts.append(REPLY_RULES)
    return "\n\n".join(parts)


def crew_steps(email: Dict, knowledge: str | None) -> List[CrewStep]:
    kb = knowledge or "Company knowledge base: no relevant entries."
    return [
        CrewStep(
            name="Email Classifier",
            role="Email Classifier",
            goal="Categorize the email and identify what the sender wants",
            backstory="You triage thousands of business emails and spot spam instantly.",
            description=(
                "Classify this email: what the sender wants, its category and keywords.\n\n"
                f"{CATEGORY_GUIDE}\n\n{describe_email(email)}"
            ),
            expected_output="Category, one-line intent and keywords",
        ),
        CrewStep(
            name="Sentiment Analyzer",
            role="Sentiment Analyzer",
            goal="Judge tone and urgency",
            backstory="You read between the lines of customer communication.",
            description="Assess sentiment (positive/neutral/negative), emotional tone and urgency "
                        "(urgent/high/medium/low) of the email, with a short justification.",
            expected_output="Sentiment, tone and urgency with justification",
        ),
        CrewStep(
            name="Response Drafter",
            role="Response Drafter",
            goal="Write the best possible reply",
            backstory="You write clear, empathetic business replies.",
            description=f"Draft the reply to this email.\n\n{REPLY_RULES}\n\n{kb}",
            expected_output="The complete reply text",
        ),
        CrewStep(
            name="Action Coordinator",
            role="Action Coordinator",
            goal="Decide ownership and follow-up",
            backstory="You make sure nothing falls through the cracks.",
            description="Decide the owning team, whether action is required, tags, and any follow-up.",
            expected_output="Owning team, action required (yes/no), tags",
        ),
    ]


def structure_prompt(email: Dict, crew_outputs: List[str]) -> str:
    work = "\n\n".join(f"--- {name} ---\n{out}" for name, out in
                       zip(["Classifier", "Sentiment", "Draft reply", "Actions"], crew_outputs))
    return (
        "Convert the team's analysis into the required structured result. "
        "Use the drafted reply as draft_reply, unchanged.\n\n"
        f"{CATEGORY_GUIDE}\n\n{describe_email(email)}\n\nTeam analysis:\n{work}"
    )
