"""
Structured AI outputs.

The model fills these schemas directly (JSON-schema constrained output), so the
app gets real fields like `lead_score` instead of a paragraph of text.

Field order matters: the model writes fields top to bottom, so explanation
fields come BEFORE the decisions they justify ("think, then answer"). With small
local models this noticeably improves categories and scores.

Rules that must always hold (score -> level, amount -> approval) are applied
in code afterwards, because small models are not reliable at them.
"""
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

Priority = Literal["urgent", "high", "medium", "low"]


class ScoreBreakdown(BaseModel):
    """The model scores each category within its limits; the code adds them up."""
    company_size: int = Field(ge=0, le=25, description="25 large/well-known or 100+ team, 15 mid-size, 8 small, 0 unknown")
    industry_fit: int = Field(ge=0, le=20, description="20 B2B with sales/ops teams, 10 partial, 0 poor/unknown")
    budget: int = Field(ge=0, le=20, description="20 approved, 10 being discussed, 0 not mentioned")
    urgency: int = Field(ge=0, le=15, description="15 this month/quarter, 8 this year, 0 no timeline")
    decision_maker: int = Field(ge=0, le=10, description="10 leads/owns the purchase, 5 unclear, 0 not a decision maker")
    intent: int = Field(ge=0, le=10, description="10 specific need, 5 general interest, 0 just browsing")

    @property
    def total(self) -> int:
        return (self.company_size + self.industry_fit + self.budget + self.urgency
                + self.decision_maker + self.intent)


SalesTeam = Literal["Enterprise sales", "Mid-market sales", "SMB sales", "Partnerships", "Nurture"]


class LeadResult(BaseModel):
    company_summary: str = Field(
        default="",
        description="1-2 sentences on what the company does, using ONLY the research findings. Empty if there are none.")
    score_breakdown: ScoreBreakdown
    reasoning: str = Field(description="2-3 sentences explaining the main points awarded and missed")
    priority: Priority
    assigned_to: SalesTeam = Field(
        description="Enterprise sales for large companies, Mid-market/SMB sales by size, "
                    "Partnerships ONLY for reseller/integration proposals, Nurture for weak leads")
    recommended_action: str = Field(description="One concrete next step for that team")
    talking_points: List[str] = Field(min_length=2, max_length=4, description="2-4 short points the sales rep should raise")
    # lead_score and qualification are added to the stored result by code (see processing.apply_rules)


class EmailResult(BaseModel):
    summary: str = Field(description="One sentence: who is writing and what they want")
    category: Literal["support", "sales", "billing", "partnership", "spam", "other"]
    sentiment: Literal["positive", "neutral", "negative"]
    priority: Priority
    action_required: bool
    assigned_team: str = Field(description="Team that should handle it, e.g. 'Technical support', 'Billing'")
    tags: List[str] = Field(default_factory=list)
    draft_reply: str = Field(description="Complete, polite reply ready to send. Empty only for spam.")


class ExtractedField(BaseModel):
    name: str
    value: str


class LineItem(BaseModel):
    description: str
    amount: float = Field(description="Line total as a plain number")


class DocumentResult(BaseModel):
    summary: str = Field(description="One sentence summary of the document")
    document_type: Literal["invoice", "contract", "receipt", "purchase_order", "other"]
    # Required-but-nullable: small models skip optional keys, so every key must be written (null if absent)
    counterparty: Optional[str] = Field(
        description="Who ISSUED the document: the 'From' / vendor / merchant / seller. NOT the 'To' or bill-to party.")
    document_number: Optional[str] = Field(description="Invoice/contract/receipt number; null if absent")
    issue_date: Optional[str] = Field(description="Date issued, YYYY-MM-DD; null if absent")
    due_date: Optional[str] = Field(description="Payment due date, YYYY-MM-DD; null unless the document states one")
    line_items: List[LineItem] = Field(description="Each charged line with its line total. Empty if none.")
    tax_amount: Optional[float] = Field(description="Total tax as a plain number; null if none")
    total_amount: Optional[float] = Field(description="Final total as a plain number (e.g. 5900.0); null if absent")
    currency: Optional[str] = Field(description="ISO code like USD, EUR, INR; null if absent")
    fields: List[ExtractedField] = Field(description="Other key data such as payment terms or parties")
    ai_notes: List[str] = Field(description="Anything unusual you noticed in the document. Empty list if nothing.")
    next_steps: List[str]
    # issues, validation_status, approval_required and approver are computed by code
    # from the extracted data and the approval policy (see processing.validate_document)


RESULT_SCHEMAS = {
    "lead": LeadResult,
    "email": EmailResult,
    "document": DocumentResult,
}


def qualification_for(score: int) -> str:
    if score >= 80:
        return "High"
    if score >= 50:
        return "Medium"
    return "Low"
