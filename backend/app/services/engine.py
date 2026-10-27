"""
Workflow engine for visual (graph) workflows.

A workflow's `config` is a graph in React Flow format:
  {"nodes": [{"id", "type", "data", "position"}], "edges": [{"id", "source", "target", "sourceHandle"}]}

Node types
- trigger:   data.trigger = manual | form | inbox | webhook     (exactly one per workflow)
- ai:        data.task = lead | email | document, data.mode = quick | crew
- condition: data.field (e.g. "lead_score" or "input.company"), data.operator, data.value
             outgoing edges use sourceHandle "true" / "false"
- action:    data.action = slack | webhook | crm | email_draft | approval
             slack: data.text (template, e.g. "Hot lead {input.name}: {result.lead_score}")
             webhook: data.url
             approval: data.approval_action = email_reply | crm_contact | document_approval | slack_message

"""
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.database import session_scope
from app.integrations import append_draft, post_slack, post_webhook, upsert_contact
from app.models import Workflow, WorkflowExecution
from app.schemas import DocumentInput, EmailInput, LeadInput
from app.services import approvals
from app.services import runs as runs_service

NODE_TYPES = {"trigger", "ai", "condition", "action"}
TRIGGERS = {"manual", "form", "inbox", "webhook"}
TASKS = {"lead", "email", "document"}
OPERATORS = {"eq", "neq", "gt", "gte", "lt", "lte", "contains", "is_true", "is_false"}
ACTIONS = {"slack", "webhook", "crm", "email_draft", "approval"}
INPUT_SCHEMAS = {"lead": LeadInput, "email": EmailInput, "document": DocumentInput}
MAX_STEPS = 100


class WorkflowError(ValueError):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def has_graph(config: Optional[Dict]) -> bool:
    return bool(config and config.get("nodes"))


# ---------------- validation ----------------
def validate_graph(config: Dict) -> List[str]:
    errors: List[str] = []
    nodes = config.get("nodes") or []
    edges = config.get("edges") or []
    ids = [n.get("id") for n in nodes]
    if len(ids) != len(set(ids)):
        errors.append("Node ids must be unique")
    by_id = {n.get("id"): n for n in nodes}

    triggers = [n for n in nodes if n.get("type") == "trigger"]
    if len(triggers) != 1:
        errors.append("A workflow needs exactly one trigger node")

    for n in nodes:
        t, d, nid = n.get("type"), n.get("data") or {}, n.get("id")
        if t not in NODE_TYPES:
            errors.append(f"Node {nid}: unknown type '{t}'")
        elif t == "trigger" and d.get("trigger") not in TRIGGERS:
            errors.append(f"Node {nid}: trigger must be one of {sorted(TRIGGERS)}")
        elif t == "ai":
            if d.get("task") not in TASKS:
                errors.append(f"Node {nid}: AI task must be one of {sorted(TASKS)}")
            if d.get("mode", "quick") not in ("quick", "crew"):
                errors.append(f"Node {nid}: mode must be quick or crew")
        elif t == "condition":
            if not d.get("field"):
                errors.append(f"Node {nid}: condition needs a field")
            if d.get("operator") not in OPERATORS:
                errors.append(f"Node {nid}: operator must be one of {sorted(OPERATORS)}")
        elif t == "action":
            a = d.get("action")
            if a not in ACTIONS:
                errors.append(f"Node {nid}: action must be one of {sorted(ACTIONS)}")
            elif a == "webhook" and not str(d.get("url", "")).startswith(("http://", "https://")):
                errors.append(f"Node {nid}: webhook action needs an http(s) URL")
            elif a == "approval" and d.get("approval_action") not in approvals.ACTIONS:
                errors.append(f"Node {nid}: approval_action must be one of {list(approvals.ACTIONS)}")

    adjacency: Dict[str, List[str]] = {i: [] for i in by_id}
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s not in by_id or t not in by_id:
            errors.append(f"Edge {e.get('id')}: connects unknown nodes")
            continue
        if by_id[t].get("type") == "trigger":
            errors.append("Nothing can connect into the trigger")
        if by_id[s].get("type") == "condition" and e.get("sourceHandle") not in ("true", "false"):
            errors.append(f"Edge {e.get('id')}: condition edges must come from the 'true' or 'false' handle")
        adjacency[s].append(t)

    # cycle detection (DFS colors)
    color: Dict[str, int] = {}

    def visit(node_id: str) -> bool:
        color[node_id] = 1
        for nxt in adjacency.get(node_id, []):
            if color.get(nxt) == 1 or (color.get(nxt) is None and visit(nxt)):
                return True
        color[node_id] = 2
        return False

    if any(color.get(i) is None and visit(i) for i in by_id):
        errors.append("Workflow contains a loop; connections must flow one way")
    return errors


def trigger_of(workflow: Workflow) -> Optional[str]:
    if not has_graph(workflow.config):
        return None
    for n in workflow.config["nodes"]:
        if n.get("type") == "trigger":
            return (n.get("data") or {}).get("trigger")
    return None


def workflows_for_trigger(db: Session, trigger: str) -> List[Workflow]:
    return [w for w in db.query(Workflow).filter(Workflow.is_active.is_(True)).all() if trigger_of(w) == trigger]


# ---------------- helpers ----------------
def lookup(ctx: Dict, path: str) -> Any:
    """Resolve 'lead_score' (from result), 'result.x', or 'input.x'."""
    parts = path.strip().split(".")
    if parts[0] not in ("result", "input"):
        parts = ["result"] + parts
    cur: Any = ctx
    for p in parts:
        if isinstance(cur, dict):
            cur = cur.get(p)
        else:
            return None
    return cur


def render(template: str, ctx: Dict) -> str:
    def sub(m):
        val = lookup(ctx, m.group(1))
        return "" if val is None else str(val)
    return re.sub(r"\{([a-zA-Z0-9_.]+)\}", sub, template or "")


def compare(actual: Any, operator: str, expected: Any) -> bool:
    if operator == "is_true":
        return actual is True or str(actual).lower() == "true"
    if operator == "is_false":
        return actual is False or str(actual).lower() == "false" or actual is None
    if operator == "contains":
        if isinstance(actual, list):
            return any(str(expected).lower() == str(x).lower() for x in actual)
        return str(expected).lower() in str(actual or "").lower()
    try:
        a, b = float(actual), float(expected)
    except (TypeError, ValueError):
        a, b = str(actual or "").lower(), str(expected or "").lower()
    return {
        "eq": a == b, "neq": a != b, "gt": a > b, "gte": a >= b, "lt": a < b, "lte": a <= b,
    }[operator]


# ---------------- execution ----------------
class _Runner:
    def __init__(self, execution_id: int, workflow: Dict, input_data: Dict):
        self.execution_id = execution_id
        self.workflow = workflow
        self.ctx: Dict[str, Any] = {"input": input_data, "result": None, "kind": None, "run_id": None}
        self.logs: List[Dict] = []

    def save(self, **fields):
        with session_scope() as db:
            ex = db.get(WorkflowExecution, self.execution_id)
            ex.agent_logs = list(self.logs)
            for k, v in fields.items():
                setattr(ex, k, v)
            db.commit()

    def log(self, node: Dict, status: str, detail: str, **extra):
        entry = {"node_id": node.get("id"), "type": node.get("type"),
                 "label": (node.get("data") or {}).get("label") or node.get("type"),
                 "status": status, "detail": detail, "at": _now(), **extra}
        self.logs.append(entry)
        self.save()

    def run_ai(self, node: Dict):
        d = node["data"]
        kind, mode = d["task"], d.get("mode", "quick")
        try:
            data = INPUT_SCHEMAS[kind](**self.ctx["input"]).model_dump(mode="json")
        except ValidationError as e:
            raise WorkflowError(f"Input doesn't fit a {kind}: {e.errors()[0]['loc']} {e.errors()[0]['msg']}")
        with session_scope() as db:
            run = runs_service.create_run(db, kind, data, mode, source="workflow",
                                          workflow_execution_id=self.execution_id)
        run = runs_service.execute_run(run.id, followups=False)
        if run.status != "completed":
            raise WorkflowError(f"AI step failed: {run.error}")
        self.ctx.update(result=run.output, kind=kind, run_id=run.id, ai_input=data)
        self.log(node, "completed", f"{kind} ({mode}) finished", run_id=run.id)

    def run_condition(self, node: Dict) -> str:
        d = node["data"]
        actual = lookup(self.ctx, d["field"])
        passed = compare(actual, d["operator"], d.get("value"))
        branch = "true" if passed else "false"
        self.log(node, "completed", f"{d['field']} = {actual!r} {d['operator']} {d.get('value')!r} -> {branch}")
        return branch

    def run_action(self, node: Dict):
        d = node["data"]
        action, result, kind = d["action"], self.ctx["result"] or {}, self.ctx["kind"]
        data = self.ctx.get("ai_input") or self.ctx["input"]
        if action == "slack":
            text = render(d.get("text") or "FlowMancer: {kind} processed", {**self.ctx, "kind": kind})
            res = post_slack(text)
        elif action == "webhook":
            res = post_webhook({"workflow": self.workflow, "input": self.ctx["input"],
                                "kind": kind, "result": result}, d["url"])
        elif action == "crm":
            if kind != "lead":
                raise WorkflowError("CRM action needs a lead AI step before it")
            res = upsert_contact(approvals.crm_contact_payload(data, result))
        elif action == "email_draft":
            if kind != "email":
                raise WorkflowError("Email draft action needs an email AI step before it")
            p = approvals.email_reply_payload(data, result)
            res = append_draft(p["to"], p["subject"], p["body"], p["in_reply_to"])
        else:  # approval
            target = d["approval_action"]
            if target == "slack_message":
                proposal = {"action": "slack_message", "title": d.get("label") or "Send Slack message",
                            "payload": {"text": render(d.get("text") or "FlowMancer update", self.ctx)}}
            else:
                proposal = approvals.proposal_for_action(target, kind, data, result)
            with session_scope() as db:
                appr = approvals.create(db, proposal, run_id=self.ctx["run_id"],
                                        workflow_execution_id=self.execution_id)
                res = {"status": "success", "detail": f"Approval #{appr.id} created", "approval_id": appr.id}
        status = "failed" if res["status"] == "error" else res["status"]
        self.log(node, "completed" if status == "success" else status, res["detail"])

    def run_graph(self, graph: Dict):
        nodes = {n["id"]: n for n in graph["nodes"]}
        out: Dict[str, List[Dict]] = {}
        for e in graph.get("edges") or []:
            out.setdefault(e["source"], []).append(e)
        trigger = next(n for n in graph["nodes"] if n["type"] == "trigger")
        self.log(trigger, "completed", f"Triggered ({trigger['data'].get('trigger')})")

        stack = [e["target"] for e in reversed(out.get(trigger["id"], []))]
        steps = 0
        while stack:
            steps += 1
            if steps > MAX_STEPS:
                raise WorkflowError("Too many steps")
            node = nodes[stack.pop()]
            branch = None
            if node["type"] == "ai":
                self.run_ai(node)
            elif node["type"] == "condition":
                if self.ctx["result"] is None and not node["data"]["field"].startswith("input."):
                    raise WorkflowError("Condition reads the AI result, but no AI step ran before it")
                branch = self.run_condition(node)
            elif node["type"] == "action":
                self.run_action(node)
            nexts = [e for e in out.get(node["id"], []) if branch is None or e.get("sourceHandle") == branch]
            stack.extend(e["target"] for e in reversed(nexts))


def start_execution(db: Session, workflow: Workflow, input_data: Dict) -> WorkflowExecution:
    """Create an execution and run it in the background."""
    if not workflow.is_active:
        raise WorkflowError("Workflow is not active")
    if not has_graph(workflow.config):
        raise WorkflowError("This workflow has no steps yet. Open it in the builder and add some.")
    errors = validate_graph(workflow.config)
    if errors:
        raise WorkflowError("; ".join(errors))
    execution = WorkflowExecution(workflow_id=workflow.id, input_data=input_data, status="pending", agent_logs=[])
    db.add(execution)
    db.commit()
    db.refresh(execution)
    runs_service.submit(execute, execution.id)
    return execution


def execute(execution_id: int):
    """Run a workflow execution to completion (called in a worker thread)."""
    with session_scope() as db:
        ex = db.get(WorkflowExecution, execution_id)
        wf = db.get(Workflow, ex.workflow_id)
        graph = wf.config
        meta = {"id": wf.id, "name": wf.name}
        input_data = dict(ex.input_data or {})

    runner = _Runner(execution_id, meta, input_data)
    started = time.monotonic()
    runner.save(status="running")
    try:
        runner.run_graph(graph)
        runner.save(status="completed", output_data={"kind": runner.ctx["kind"], "result": runner.ctx["result"],
                                                     "run_id": runner.ctx["run_id"]},
                    completed_at=datetime.now(timezone.utc), duration_seconds=int(time.monotonic() - started))
    except Exception as e:
        runner.logs.append({"node_id": None, "type": "error", "label": "Error", "status": "failed",
                            "detail": str(e), "at": _now()})
        runner.save(status="failed", error_message=str(e),
                    completed_at=datetime.now(timezone.utc), duration_seconds=int(time.monotonic() - started))

