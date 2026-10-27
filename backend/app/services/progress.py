"""
Step tracking for runs.

A StepTracker holds the ordered list of pipeline steps ("Research", "Analyze", ...)
and calls `on_change` after every update. The run service uses that hook to save
steps to the database, which is what the live progress stream reads.
"""
import threading
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class StepTracker:
    def __init__(self, names: List[str], on_change: Optional[Callable[[List[Dict]], None]] = None):
        self._lock = threading.Lock()
        self._on_change = on_change
        self.steps: List[Dict] = [
            {"name": n, "status": "pending", "started_at": None, "finished_at": None, "output": None}
            for n in names
        ]

    def _find(self, name: str) -> Dict:
        for step in self.steps:
            if step["name"] == name:
                return step
        step = {"name": name, "status": "pending", "started_at": None, "finished_at": None, "output": None}
        self.steps.append(step)
        return step

    def _emit(self):
        if self._on_change:
            self._on_change([dict(s) for s in self.steps])

    def start(self, name: str):
        with self._lock:
            step = self._find(name)
            step["status"] = "running"
            step["started_at"] = _now()
        self._emit()

    def finish(self, name: str, output: Optional[str] = None):
        with self._lock:
            step = self._find(name)
            step["status"] = "completed"
            step["finished_at"] = _now()
            if output is not None:
                step["output"] = output[:4000]
        self._emit()

    def reset(self, name: str):
        """Put a step back to pending (used when a crew restarts on a backup model)."""
        with self._lock:
            step = self._find(name)
            step.update(status="pending", started_at=None, finished_at=None, output=None)
        self._emit()

    def skip(self, name: str, reason: str):
        with self._lock:
            step = self._find(name)
            step["status"] = "skipped"
            step["finished_at"] = _now()
            step["output"] = reason
        self._emit()

    def fail(self, name: str, error: str):
        with self._lock:
            step = self._find(name)
            step["status"] = "failed"
            step["finished_at"] = _now()
            step["output"] = error[:2000]
        self._emit()

    def fail_running(self, error: str):
        """Mark whichever step is running as failed (used when an exception escapes)."""
        with self._lock:
            for step in self.steps:
                if step["status"] == "running":
                    step["status"] = "failed"
                    step["finished_at"] = _now()
                    step["output"] = error[:2000]
        self._emit()
