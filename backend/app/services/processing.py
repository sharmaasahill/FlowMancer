"""
The AI pipeline for one item (lead, email or document).

    context (research / knowledge)  ->  AI (quick: 1 call | crew: 4 agents)  ->  structured result  ->  business rules

Modules are referenced as `module.function` (not imported by name) so tests can
replace the LLM, crew, research and knowledge calls.
"""
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.agents import base as crew_base
from app.agents import document_agents, email_agents, lead_agents
from app.core import llm as llm_mod
from app.core.config import settings
from app.schemas.results import RESULT_SCHEMAS, qualification_for
from app.services import knowledge as kb
from app.services import research as research_mod
from app.services.progress import StepTracker

KINDS = ("lead", "email", "document")
MODES = ("quick", "crew")

STEP_RESEARCH = "Research"
STEP_KNOWLEDGE = "Knowledge lookup"
STEP_ANALYZE = "Analyze"
STEP_STRUCTURE = "Structure results"


@dataclass
class Outcome:
    output: Dict
    raw_text: Optional[str] = None
    research: List[Dict] = field(default_factory=list)
    knowledge: List[Dict] = field(default_factory=list)
    ai_model: str = ""


def _crew_steps(kind: str, data: Dict, research_text: str, knowledge_text: Optional[str]):
    if kind == "lead":
        return lead_agents.crew_steps(data, research_text, knowledge_text)
    if kind == "email":
        return email_agents.crew_steps(data, knowledge_text)
    return document_agents.crew_steps(data, knowledge_text)


def step_names(kind: str, mode: str) -> List[str]:
    names = [STEP_RESEARCH] if kind == "lead" else []
    names.append(STEP_KNOWLEDGE)
    if mode == "crew":
        names += [s.name for s in _crew_steps(kind, {}, "", None)] + [STEP_STRUCTURE]
    else:
        names.append(STEP_ANALYZE)
    return names


def _knowledge_query(kind: str, data: Dict) -> str:
    if kind == "lead":
        return f"{data.get('message') or ''} {data.get('company') or ''} pricing plans product"
    if kind == "email":
        return f"{data.get('subject', '')}\n{data.get('body', '')}"[:1500]
    return (data.get("file_content") or "")[:1000]


def apply_rules(kind: str, output: Dict, data: Optional[Dict] = None) -> Dict:
    """Deterministic business rules on top of the model's answer."""
    if kind == "lead":
        breakdown = output.get("score_breakdown") or {}
        output["lead_score"] = max(0, min(100, sum(int(v or 0) for v in breakdown.values())))
        output["qualification"] = qualification_for(output["lead_score"])
        # Weak leads go to nurture; qualified leads always reach a sales team
        if output["qualification"] == "Low":
            output["assigned_to"] = "Nurture"
        elif output.get("assigned_to") == "Nurture":
            size = int(breakdown.get("company_size") or 0)
            output["assigned_to"] = "Enterprise sales" if size >= 20 else "Mid-market sales" if size >= 12 else "SMB sales"
    elif kind == "email":
        if output.get("category") == "spam":
            output["draft_reply"] = ""
            output["action_required"] = False
    elif kind == "document":
        validate_document(output, (data or {}).get("file_content") or "")
        amount = output.get("total_amount")
        output["approval_required"] = bool(
            output.get("document_type") == "contract"
            or output.get("validation_status") != "valid"
            or (amount is not None and amount >= settings.DOCUMENT_APPROVAL_AMOUNT)
        )
        output["approver"] = (("Legal" if output.get("document_type") == "contract" else "Finance")
                              if output["approval_required"] else None)
    return output


NULL_STRINGS = {"null", "none", "n/a", "na", "unknown", "-", ""}
SUMMARY_LINE = re.compile(r"^\s*(sub\s*-?\s*total|total|grand total|tax|gst|vat|amount due|balance)\b", re.I)
ISSUER_LABEL = re.compile(r"(?im)^\s*(?:from|vendor|seller|supplier|issued by|billed by|merchant)\s*[:\-]\s*(.+?)\s*$")


def validate_document(output: Dict, content: str = "") -> None:
    """
    Deterministic checks on the extracted data. Small models are unreliable at arithmetic and
    tend to list noise as "issues", so validation is decided here, not by the model.
    """
    for key in ("counterparty", "document_number", "issue_date", "due_date", "currency"):
        if isinstance(output.get(key), str) and output[key].strip().lower() in NULL_STRINGS:
            output[key] = None

    # An explicit "From:/Vendor:" label in the text beats the model's guess (it often picks the bill-to party)
    labelled = ISSUER_LABEL.search(content or "")
    if labelled:
        output["counterparty"] = labelled.group(1)[:200]

    # Subtotal/total/tax lines are not charges
    items = [i for i in (output.get("line_items") or []) if not SUMMARY_LINE.match(i.get("description") or "")]
    output["line_items"] = items
    total, tax = output.get("total_amount"), output.get("tax_amount")
    if tax is not None and total is not None and tax >= total:
        output["tax_amount"] = None  # a tax as large as the total is a misread

    issues, invalid = [], False
    if items and total is not None:
        expected = round(sum(float(i.get("amount") or 0) for i in items) + float(output.get("tax_amount") or 0), 2)
        if abs(expected - total) > max(0.01, total * 0.005):
            issues.append(f"Line items plus tax add up to {expected:g}, but the stated total is {total:g}")
            invalid = True
    if output.get("document_type") in ("invoice", "receipt", "purchase_order"):
        if total is None:
            issues.append("No total amount found")
        if not output.get("counterparty"):
            issues.append("Issuer/vendor not identified")

    output["issues"] = issues
    output["validation_status"] = "invalid" if invalid else "needs_review" if issues else "valid"


def process(kind: str, data: Dict, mode: str, tracker: StepTracker) -> Outcome:
    if kind not in KINDS:
        raise ValueError(f"Unknown kind: {kind}")
    if mode not in MODES:
        raise ValueError(f"Unknown mode: {mode}")

    outcome = Outcome(output={}, ai_model=llm_mod.model_label())

    # 1. Context gathering
    research_text = ""
    if kind == "lead":
        tracker.start(STEP_RESEARCH)
        research = research_mod.research_lead(data)
        outcome.research = research.sources
        research_text = research.as_prompt()
        if research.sources:
            tracker.finish(STEP_RESEARCH, f"{len(research.sources)} sources found")
        else:
            tracker.skip(STEP_RESEARCH, research.note or "Nothing found")

    tracker.start(STEP_KNOWLEDGE)
    try:
        outcome.knowledge = kb.search(_knowledge_query(kind, data))
    except Exception as e:
        outcome.knowledge = []
        tracker.skip(STEP_KNOWLEDGE, f"Knowledge base unavailable: {e}")
    else:
        if outcome.knowledge:
            tracker.finish(STEP_KNOWLEDGE, f"{len(outcome.knowledge)} relevant snippets")
        else:
            tracker.skip(STEP_KNOWLEDGE, "No relevant knowledge-base entries")
    knowledge_text = kb.as_prompt(outcome.knowledge)

    schema = RESULT_SCHEMAS[kind]

    # 2. AI
    if mode == "quick":
        tracker.start(STEP_ANALYZE)
        if kind == "lead":
            prompt = lead_agents.quick_prompt(data, research_text, knowledge_text)
        elif kind == "email":
            prompt = email_agents.quick_prompt(data, knowledge_text)
        else:
            prompt = document_agents.quick_prompt(data, knowledge_text)
        result = llm_mod.structured_invoke(schema, prompt)
        tracker.finish(STEP_ANALYZE, "Structured result ready")
    else:
        steps = _crew_steps(kind, data, research_text, knowledge_text)
        crew_outputs = crew_base.run_crew(steps, tracker)
        outcome.raw_text = "\n\n".join(f"## {s.name}\n{o}" for s, o in zip(steps, crew_outputs))

        tracker.start(STEP_STRUCTURE)
        if kind == "lead":
            prompt = lead_agents.structure_prompt(data, research_text, crew_outputs)
        elif kind == "email":
            prompt = email_agents.structure_prompt(data, crew_outputs)
        else:
            prompt = document_agents.structure_prompt(data, crew_outputs)
        result = llm_mod.structured_invoke(schema, prompt)
        tracker.finish(STEP_STRUCTURE, "Structured result ready")

    # 3. Business rules
    outcome.output = apply_rules(kind, result.model_dump(), data)
    return outcome
