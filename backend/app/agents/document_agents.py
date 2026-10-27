"""
Document processing: prompts for quick mode and the 4-agent crew.
"""
from typing import Dict, List

from app.agents.base import CrewStep
from app.core.config import settings

MAX_DOC_CHARS = 12000


def describe_document(doc: Dict) -> str:
    content = doc.get("file_content") or ""
    truncated = len(content) > MAX_DOC_CHARS
    hint = doc.get("document_type") or "auto"
    name = doc.get("file_name")
    header = f"Declared type: {hint}" + (f"\nFile: {name}" if name else "")
    note = "\n[Document truncated]" if truncated else ""
    return f"{header}\nContent:\n{content[:MAX_DOC_CHARS]}{note}"


def approval_policy() -> str:
    return (
        f"Approval policy: any document with a total of {settings.DOCUMENT_APPROVAL_AMOUNT:g} or more, "
        "every contract, and anything with validation issues needs approval. Finance approves invoices "
        "and receipts; Legal approves contracts."
    )


def quick_prompt(doc: Dict, knowledge: str | None) -> str:
    parts = [
        "You are a document processing expert. Classify this document, extract its key data exactly as written, "
        "and note any problems you see in it.",
        describe_document(doc),
        "Only extract values that appear in the document; use null for anything that isn't there.",
    ]
    if knowledge:
        parts.append(knowledge)
    return "\n\n".join(parts)


def crew_steps(doc: Dict, knowledge: str | None) -> List[CrewStep]:
    kb = f"\n\n{knowledge}" if knowledge else ""
    return [
        CrewStep(
            name="Document Classifier",
            role="Document Classifier",
            goal="Identify the document type",
            backstory="You recognize invoices, receipts, contracts and purchase orders at a glance.",
            description=f"Identify the document type and its quality.\n\n{describe_document(doc)}",
            expected_output="Document type and quality assessment",
        ),
        CrewStep(
            name="Data Extractor",
            role="Data Extraction Specialist",
            goal="Extract every key field accurately",
            backstory="You pull structured data out of messy documents.",
            description="Extract: parties, document number, dates, line items, subtotal, tax, total, "
                        "currency, payment terms. Quote values exactly as they appear.",
            expected_output="A list of extracted fields and values",
        ),
        CrewStep(
            name="Validator",
            role="Document Validator",
            goal="Find errors before they reach the books",
            backstory="You check that totals add up and nothing required is missing.",
            description="Validate the extracted data: required fields present, totals add up, dates valid. "
                        "Status: valid, invalid or needs_review, with a list of issues.",
            expected_output="Validation status and list of issues",
        ),
        CrewStep(
            name="Workflow Router",
            role="Workflow Router",
            goal="Decide approval and next steps",
            backstory="You know the company's approval chains.",
            description=f"Decide if approval is needed, who approves, and next steps.\n\n{approval_policy()}{kb}",
            # The final approval decision is re-applied in code from the same policy
            expected_output="Approval decision, approver and next steps",
        ),
    ]


def structure_prompt(doc: Dict, crew_outputs: List[str]) -> str:
    work = "\n\n".join(f"--- {name} ---\n{out}" for name, out in
                       zip(["Classifier", "Extraction", "Validation", "Routing"], crew_outputs))
    return (
        "Convert the team's analysis into the required structured result.\n\n"
        f"{describe_document(doc)}\n\nTeam analysis:\n{work}"
    )
