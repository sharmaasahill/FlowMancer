"""
AI usage and cost.

Every model attempt made inside a `scope(...)` is stored as an AICall row: who asked,
for what (lead, email, document, assistant), which model answered, tokens, time and
outcome. Calls outside a scope (the accuracy test, scripts) are not stored.

Cost is an estimate at Google's paid-tier prices (settings.AI_PRICES). On the free
tier nothing is billed; the estimate shows what the same traffic would cost on a
paid plan.
"""
import logging
from collections import defaultdict
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterator, List, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import session_scope
from app.models import AICall

log = logging.getLogger("flowmancer.usage")

_scope: ContextVar[Optional[dict]] = ContextVar("flowmancer_usage_scope", default=None)

FEATURES = ("lead", "email", "document", "assistant")
MAX_DAYS = 90
RECENT = 25


@contextmanager
def scope(user_id: Optional[int], feature: str, *, mode: Optional[str] = None, run_id: Optional[int] = None) -> Iterator[None]:
    """Attribute AI calls made inside this block to a user and feature."""
    token = _scope.set({"user_id": user_id, "feature": feature, "mode": mode, "run_id": run_id})
    try:
        yield
    finally:
        _scope.reset(token)


def record_attempt(*, provider: str, model: str, fallback: bool, status: str, error: Optional[str],
                   seconds: float, input_tokens: int, output_tokens: int, requests: int):
    """Called by app.core.llm after every attempt."""
    current = _scope.get()
    if not current or current.get("user_id") is None:
        return
    with session_scope() as db:
        db.add(AICall(user_id=current["user_id"], feature=current["feature"], mode=current.get("mode"),
                      run_id=current.get("run_id"), provider=provider, model=model, status=status,
                      fallback=fallback, requests=requests, input_tokens=input_tokens,
                      output_tokens=output_tokens, seconds=seconds, error=error))
        db.commit()


def price_of(provider: str, model: str) -> Optional[List[float]]:
    """[input, output] USD per 1M tokens, [0, 0] for local models, None if unknown."""
    if provider == "ollama":
        return [0.0, 0.0]
    price = settings.AI_PRICES.get(model)
    return [float(price[0]), float(price[1])] if price and len(price) == 2 else None


def cost_of(provider: str, model: str, input_tokens: int, output_tokens: int) -> Optional[float]:
    price = price_of(provider, model)
    if price is None:
        return None
    return (input_tokens * price[0] + output_tokens * price[1]) / 1_000_000


def _as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _bucket() -> dict:
    return {"calls": 0, "requests": 0, "failed": 0, "fallbacks": 0, "input_tokens": 0, "output_tokens": 0,
            "cost_usd": 0.0, "unpriced_calls": 0, "_seconds": [], "_runs": set()}


def _add(b: dict, c: AICall):
    b["calls"] += 1
    b["requests"] += c.requests or 1
    b["failed"] += c.status != "ok"
    b["fallbacks"] += bool(c.fallback) and c.status == "ok"
    b["input_tokens"] += c.input_tokens or 0
    b["output_tokens"] += c.output_tokens or 0
    cost = cost_of(c.provider, c.model, c.input_tokens or 0, c.output_tokens or 0)
    if cost is None:
        b["unpriced_calls"] += 1
    else:
        b["cost_usd"] += cost
    if c.status == "ok" and c.seconds is not None:
        b["_seconds"].append(c.seconds)
    if c.run_id is not None and c.status == "ok":
        b["_runs"].add(c.run_id)


def _finish(b: dict) -> dict:
    seconds, runs = b.pop("_seconds"), b.pop("_runs")
    b["avg_seconds"] = round(sum(seconds) / len(seconds), 2) if seconds else None
    b["items"] = len(runs)
    b["cost_usd"] = round(b["cost_usd"], 6)
    return b


def summary(db: Session, user_id: int, days: int = 7) -> Dict:
    """Usage for one account over the last `days` days (UTC)."""
    days = max(1, min(MAX_DAYS, days))
    now = datetime.now(timezone.utc)
    start_day = now.date() - timedelta(days=days - 1)
    since = datetime(start_day.year, start_day.month, start_day.day, tzinfo=timezone.utc)
    calls = (db.query(AICall).filter(AICall.user_id == user_id, AICall.created_at >= since.replace(tzinfo=None))
             .order_by(AICall.id.desc()).all())
    calls = [c for c in calls if c.created_at and _as_utc(c.created_at) >= since]  # SQLite stores naive UTC

    totals, today = _bucket(), _bucket()
    by_model: Dict[tuple, dict] = defaultdict(_bucket)
    by_feature: Dict[str, dict] = defaultdict(_bucket)
    per_day = {(start_day + timedelta(days=i)).isoformat(): _bucket() for i in range(days)}
    for c in calls:
        _add(totals, c)
        _add(by_model[(c.provider, c.model)], c)
        _add(by_feature[c.feature], c)
        day = _as_utc(c.created_at).date().isoformat()
        if day in per_day:
            _add(per_day[day], c)
        if day == now.date().isoformat():
            _add(today, c)

    models = []
    for (provider, model), b in by_model.items():
        models.append({"provider": provider, "model": model, "price_per_million": price_of(provider, model), **_finish(b)})
    models.sort(key=lambda m: -m["calls"])

    features = []
    for name in FEATURES:
        if name in by_feature:
            b = _finish(by_feature[name])
            b["tokens_per_item"] = round((b["input_tokens"] + b["output_tokens"]) / b["items"]) if b["items"] else None
            b["cost_per_item_usd"] = round(b["cost_usd"] / b["items"], 6) if b["items"] else None
            features.append({"feature": name, **b})

    daily = []
    for date, b in per_day.items():
        b = _finish(b)
        daily.append({"date": date, "requests": b["requests"], "failed": b["failed"],
                      "input_tokens": b["input_tokens"], "output_tokens": b["output_tokens"], "cost_usd": b["cost_usd"]})

    recent = [{
        "id": c.id, "created_at": _as_utc(c.created_at).isoformat(), "feature": c.feature, "mode": c.mode,
        "run_id": c.run_id, "provider": c.provider, "model": c.model, "status": c.status, "fallback": c.fallback,
        "requests": c.requests, "input_tokens": c.input_tokens, "output_tokens": c.output_tokens,
        "seconds": c.seconds, "error": c.error,
        "cost_usd": cost_of(c.provider, c.model, c.input_tokens or 0, c.output_tokens or 0),
    } for c in calls[:RECENT]]

    return {
        "days": days,
        "since": since.isoformat(),
        "totals": _finish(totals),
        "today": _finish(today),
        "by_model": models,
        "by_feature": features,
        "daily": daily,
        "recent": recent,
        "prices": {m: price_of("gemini", m) for m in settings.AI_PRICES},
        "provider": settings.AI_PROVIDER.lower(),
    }
