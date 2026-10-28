"""
"Ask FlowMancer": a tool-using assistant over the signed-in user's own data.

The model can read (search runs, open a run, stats, approvals, knowledge base) and
can *propose* actions (an email reply, a Slack message). Proposals become pending
items in the Approvals queue; nothing is sent from here.

Every tool is bound to one user, so the model can never read another account's data.
"""
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Literal, Optional

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core import llm as llm_mod
from app.models import Approval, KnowledgeDocument, Run, User
from app.services import approvals as approvals_service
from app.services import knowledge as kb
from app.services import stats as stats_service
from app.services import usage

MAX_ROUNDS = 6           # model <-> tools round trips per question
MAX_TOOL_CHARS = 6000    # tool output sent back to the model
SCAN_LIMIT = 500         # most recent runs considered by search_runs

SYSTEM_PROMPT = """You are FlowMancer's assistant, helping {name} with their sales leads, customer emails and \
business documents. Today is {today}.

You can look things up with tools. Use them before answering any question about the user's data; never guess.
- Refer to processed items as "run #<id>" (for example "run #12") and approvals as "approval #<id>"; the app turns these into links.
- Keep answers short and concrete. Use a bullet list when listing several items.
- If the tools find nothing, say so plainly.
- You cannot send emails or messages. draft_email and draft_slack_message only put a draft in the Approvals queue,
  where {name} must approve it. Say that clearly after drafting, and never claim something was sent.
- When drafting an email, check the knowledge base for the relevant policy first and use its exact terms
  (time limits, amounts). The draft must not say anything has already been done (refunded, fixed, shipped);
  describe what will happen next. Sign it with {name}'s name.
- Only state facts that come from tool results or the user."""


# ---------------- tool argument schemas ----------------
class SearchRunsArgs(BaseModel):
    kind: Optional[Literal["lead", "email", "document"]] = Field(None, description="Type of item")
    text: Optional[str] = Field(None, description="Words to match in name, company, email address, subject or file")
    qualification: Optional[Literal["High", "Medium", "Low"]] = Field(None, description="Lead quality")
    category: Optional[str] = Field(None, description="Email category: support, sales, billing, partnership, spam, other")
    priority: Optional[Literal["urgent", "high", "medium", "low"]] = Field(None, description="Email or lead priority")
    status: Optional[Literal["queued", "running", "completed", "failed"]] = None
    since_days: Optional[int] = Field(None, ge=1, le=3650, description="Only items from the last N days")
    limit: int = Field(10, ge=1, le=25)


class GetRunArgs(BaseModel):
    run_id: int = Field(..., description="The run number, e.g. 12 for run #12")


class ListApprovalsArgs(BaseModel):
    status: Literal["pending", "approved", "rejected"] = "pending"
    limit: int = Field(15, ge=1, le=50)


class SearchKnowledgeArgs(BaseModel):
    query: str = Field(..., min_length=1, description="What to look up in the company's policies and documents")


class DraftEmailArgs(BaseModel):
    to: str = Field(..., description="Recipient email address")
    subject: str = Field(..., max_length=200)
    body: str = Field(..., max_length=5000, description=(
        "The complete email text. A person reviews it before it goes out, so never write that something is "
        "already done ('I have processed', 'we have refunded'). Write what will happen next instead "
        "('we will process your refund')."))
    run_id: Optional[int] = Field(None, description="The email run this replies to, if any")


class DraftSlackArgs(BaseModel):
    text: str = Field(..., max_length=3000)


class NoArgs(BaseModel):
    pass


# ---------------- helpers ----------------
def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return (dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt).isoformat()


def _brief(run: Run) -> Dict[str, Any]:
    """Compact description of a run for search results."""
    i, o = run.input_data or {}, run.output or {}
    item: Dict[str, Any] = {"run_id": run.id, "kind": run.kind, "status": run.status, "created_at": _iso(run.created_at)}
    if run.kind == "lead":
        item.update(name=i.get("name"), company=i.get("company"), email=i.get("email"),
                    score=o.get("lead_score"), qualification=o.get("qualification"), owner_team=o.get("assigned_to"))
    elif run.kind == "email":
        item.update(sender=i.get("from_email"), subject=i.get("subject"), category=o.get("category"),
                    priority=o.get("priority"), sentiment=o.get("sentiment"))
    else:
        item.update(file=i.get("file_name"), document_type=o.get("document_type"), issuer=o.get("counterparty"),
                    total=o.get("total_amount"), currency=o.get("currency"),
                    validation=o.get("validation_status"), needs_approval=o.get("approval_required"))
    if run.error:
        item["error"] = run.error[:200]
    return {k: v for k, v in item.items() if v is not None}


def _matches(run: Run, a: SearchRunsArgs, since: Optional[datetime]) -> bool:
    i, o = run.input_data or {}, run.output or {}
    if a.kind and run.kind != a.kind:
        return False
    if a.status and run.status != a.status:
        return False
    if a.qualification and o.get("qualification") != a.qualification:
        return False
    if a.category and (o.get("category") or "").lower() != a.category.lower():
        return False
    if a.priority and o.get("priority") != a.priority:
        return False
    if since and run.created_at:
        created = run.created_at.replace(tzinfo=timezone.utc) if run.created_at.tzinfo is None else run.created_at
        if created < since:
            return False
    if a.text:
        hay = " ".join(str(v) for v in (i.get("name"), i.get("company"), i.get("email"), i.get("from_email"),
                                        i.get("subject"), i.get("file_name"), o.get("counterparty")) if v).lower()
        if not all(word in hay for word in a.text.lower().split()):
            return False
    return True


@dataclass
class Toolbox:
    """The tools for one user. Records what was used and which approvals were drafted."""
    db: Session
    user: User
    trace: List[Dict[str, Any]] = field(default_factory=list)
    drafted: List[int] = field(default_factory=list)

    # ---- read ----
    def search_runs(self, **kwargs) -> Any:
        a = SearchRunsArgs(**kwargs)
        since = datetime.now(timezone.utc) - timedelta(days=a.since_days) if a.since_days else None
        recent = (self.db.query(Run).filter(Run.user_id == self.user.id)
                  .order_by(Run.id.desc()).limit(SCAN_LIMIT).all())
        hits = [r for r in recent if _matches(r, a, since)]
        return {"total_matches": len(hits), "items": [_brief(r) for r in hits[:a.limit]]}

    def get_run(self, run_id: int) -> Any:
        run = self.db.get(Run, run_id)
        if not run or run.user_id != self.user.id:
            return {"error": f"There is no run #{run_id}."}
        inp = {k: (v[:1500] if isinstance(v, str) else v) for k, v in (run.input_data or {}).items() if v not in (None, "")}
        appr = self.db.query(Approval).filter(Approval.run_id == run.id, Approval.user_id == self.user.id).all()
        return {
            **_brief(run),
            "mode": run.mode, "source": run.source, "model": run.ai_model,
            "input": inp,
            "result": run.output,
            "sources": [{"title": s.get("title"), "url": s.get("url")} for s in (run.research or [])],
            "knowledge_used": sorted({k.get("doc_name") for k in (run.knowledge or []) if k.get("doc_name")}),
            "automatic_actions": [f"{x.get('reason')}: {x.get('status')}" for x in (run.actions or [])],
            "approvals": [{"approval_id": x.id, "title": x.title, "status": x.status} for x in appr],
        }

    def get_stats(self) -> Any:
        s = stats_service.compute(self.db, self.user.id)
        return {"totals": s["totals"], "leads": s["leads"], "emails": s["emails"], "documents": s["documents"]}

    def list_approvals(self, status: str = "pending", limit: int = 15) -> Any:
        rows = (self.db.query(Approval).filter(Approval.user_id == self.user.id, Approval.status == status)
                .order_by(Approval.id.desc()).limit(limit).all())
        return [{"approval_id": a.id, "action": a.action, "title": a.title, "run_id": a.run_id,
                 "created_at": _iso(a.created_at)} for a in rows]

    def search_knowledge(self, query: str) -> Any:
        doc_ids = [d for (d,) in self.db.query(KnowledgeDocument.id).filter(KnowledgeDocument.user_id == self.user.id)]
        hits = kb.search(query, doc_ids=doc_ids)
        return [{"document": h["doc_name"], "text": h["text"]} for h in hits] or "Nothing relevant in the knowledge base."

    # ---- propose (goes to Approvals) ----
    def draft_email(self, to: str, subject: str, body: str, run_id: Optional[int] = None) -> Any:
        in_reply_to = None
        if run_id is not None:
            run = self.db.get(Run, run_id)
            if not run or run.user_id != self.user.id:
                return {"error": f"There is no run #{run_id}."}
            in_reply_to = (run.input_data or {}).get("message_id")
        proposal = {"action": "email_reply", "title": f"Reply to {to}: {subject}"[:255],
                    "payload": {"to": to, "subject": subject, "body": body, "in_reply_to": in_reply_to}}
        approval = approvals_service.create(self.db, proposal, user_id=self.user.id, run_id=run_id)
        self.drafted.append(approval.id)
        return {"approval_id": approval.id, "status": "pending",
                "note": "Saved to the Approvals queue. Nothing is sent until the user approves it."}

    def draft_slack_message(self, text: str) -> Any:
        proposal = {"action": "slack_message", "title": f"Slack: {text[:80]}", "payload": {"text": text}}
        approval = approvals_service.create(self.db, proposal, user_id=self.user.id)
        self.drafted.append(approval.id)
        return {"approval_id": approval.id, "status": "pending",
                "note": "Saved to the Approvals queue. It posts to Slack only after the user approves it."}

    # ---- wiring ----
    SPECS = [
        ("search_runs", SearchRunsArgs, "Search the user's processed leads, emails and documents. Returns the newest matches first."),
        ("get_run", GetRunArgs, "Full details of one processed item: input, AI result, sources, approvals."),
        ("get_stats", NoArgs, "Totals and breakdowns across all of the user's processed items."),
        ("list_approvals", ListApprovalsArgs, "Items in the approval queue (pending by default)."),
        ("search_knowledge", SearchKnowledgeArgs, "Search the company's knowledge base (policies, pricing, FAQs)."),
        ("draft_email", DraftEmailArgs, "Draft an email for the user to approve. Does NOT send it."),
        ("draft_slack_message", DraftSlackArgs, "Draft a Slack message for the user to approve. Does NOT post it."),
    ]

    def tools(self) -> List[StructuredTool]:
        return [StructuredTool.from_function(func=self._wrap(name), name=name, description=desc, args_schema=schema)
                for name, schema, desc in self.SPECS]

    def _wrap(self, name: str) -> Callable[..., str]:
        def run(**kwargs) -> str:
            return self.call(name, kwargs)
        run.__name__ = name
        return run

    def call(self, name: str, args: Dict[str, Any]) -> str:
        """Run a tool by name; errors are returned to the model as text instead of crashing the chat."""
        fn = getattr(self, name, None) if name in {s[0] for s in self.SPECS} else None
        if fn is None:
            result: Any = {"error": f"Unknown tool {name}"}
        else:
            try:
                result = fn(**(args or {}))
            except Exception as e:  # bad arguments, validation errors
                result = {"error": f"{type(e).__name__}: {e}"[:300]}
        self.trace.append({"tool": name, "args": args or {}, "ok": not (isinstance(result, dict) and "error" in result)})
        text = result if isinstance(result, str) else json.dumps(result, default=str)
        return text[:MAX_TOOL_CHARS]


# ---------------- the chat loop ----------------
@dataclass
class Reply:
    text: str
    trace: List[Dict[str, Any]]
    approval_ids: List[int]
    model: str


def _invoke(messages: List[BaseMessage], tools: List[StructuredTool]) -> AIMessage:
    """One model call with tools bound (tests replace this)."""
    return llm_mod.with_fallback(
        lambda target: llm_mod.counted(llm_mod.chat_model(target).bind_tools(tools).invoke(messages)))


def chat(db: Session, user: User, history: List[Dict[str, str]]) -> Reply:
    """Answer the last user message in `history` ([{role: user|assistant, content}])."""
    box = Toolbox(db=db, user=user)
    tools = box.tools()
    messages: List[BaseMessage] = [SystemMessage(content=SYSTEM_PROMPT.format(
        name=user.name.split()[0] if user.name else "the user",
        today=datetime.now(timezone.utc).strftime("%A, %d %B %Y")))]
    for m in history:
        messages.append(HumanMessage(content=m["content"]) if m["role"] == "user" else AIMessage(content=m["content"]))

    llm_mod.reset_used()
    text = ""
    for _ in range(MAX_ROUNDS):
        with usage.scope(user.id, "assistant"):
            ai = _invoke(messages, tools)
        messages.append(ai)
        if not ai.tool_calls:
            text = llm_mod.text_of(ai.content).strip()
            break
        for call in ai.tool_calls:
            output = box.call(call["name"], call.get("args") or {})
            messages.append(ToolMessage(content=output, tool_call_id=call.get("id") or call["name"], name=call["name"]))
    else:
        text = "I looked through a lot and couldn't finish. Try a narrower question."

    return Reply(text=text or "I don't have an answer for that.", trace=box.trace, approval_ids=box.drafted,
                 model=llm_mod.used_label())
