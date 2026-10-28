"""
Accuracy evaluation.

Runs every labelled case in eval/cases.json through the real pipeline (quick mode)
and reports how many the model gets right. Uses a throwaway database and knowledge
store, so your own data is never touched. Web research is off so results are
repeatable.

    venv/Scripts/python.exe -m eval.run_eval                     # the model in .env (Gemini)
    venv/Scripts/python.exe -m eval.run_eval --provider ollama   # compare with the local model
    venv/Scripts/python.exe -m eval.run_eval --only email --delay 6
    python -m eval.run_eval --min-accuracy 90 --summary "$GITHUB_STEP_SUMMARY"   # CI

Each case passes only if every expected field is right. A report is written to
eval/results/<model>-<date>.md (and .json).
"""
import argparse
import json
import os
import re
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--provider", choices=["gemini", "ollama"], help="Override AI_PROVIDER for this run")
    p.add_argument("--model", help="Override the model name (GEMINI_MODEL or OLLAMA_MODEL)")
    p.add_argument("--only", choices=["lead", "email", "document"], help="Run one kind of case")
    p.add_argument("--delay", type=float, default=4.5,
                   help="Seconds between cases, to stay under free-tier rate limits (default 4.5)")
    p.add_argument("--cases", type=Path, default=HERE / "cases.json")
    p.add_argument("--min-accuracy", type=float, default=None,
                   help="Exit with an error if accuracy (%% of cases passed) is below this, e.g. 90 (used by CI)")
    p.add_argument("--summary", type=Path, default=None,
                   help="Also append the Markdown report to this file (CI passes $GITHUB_STEP_SUMMARY)")
    return p.parse_args()


ARGS = parse_args()

# Isolated storage, set before the app reads its settings
_tmp = Path(tempfile.mkdtemp(prefix="flowmancer-eval-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_tmp / 'eval.db').as_posix()}"
os.environ["KNOWLEDGE_PATH"] = str(_tmp / "knowledge")
os.environ["RESEARCH_ENABLED"] = "false"
os.environ["SLACK_WEBHOOK_URL"] = ""
if ARGS.provider:
    os.environ["AI_PROVIDER"] = ARGS.provider
if ARGS.model:
    os.environ["OLLAMA_MODEL" if (ARGS.provider or os.environ.get("AI_PROVIDER")) == "ollama" else "GEMINI_MODEL"] = ARGS.model

sys.path.insert(0, str(HERE.parent))
from app.core import llm  # noqa: E402
from app.services import knowledge as kb  # noqa: E402
from app.services.processing import process, step_names  # noqa: E402
from app.services.progress import StepTracker  # noqa: E402


def check(kind: str, expect: dict, out: dict) -> list:
    """Return (field, ok, got) for every expectation."""
    results = []
    for field, want in expect.items():
        if field == "reply":
            got = bool((out.get("draft_reply") or "").strip())
            ok = got == want
        elif field == "reply_mentions":
            reply = (out.get("draft_reply") or "").lower()
            missing = [w for w in want if w.lower() not in reply]
            got, ok = (f"missing {missing}" if missing else "all present"), not missing
        elif field == "total_amount":
            got = out.get("total_amount")
            ok = got is not None and abs(float(got) - float(want)) < 0.01
        elif field == "counterparty_contains":
            got = out.get("counterparty")
            ok = bool(got) and want.lower() in got.lower()
        elif isinstance(want, list):
            got = out.get(field)
            ok = got in want
        else:
            got = out.get(field)
            ok = got == want
        results.append((field, ok, got))
    return results


def main():
    data = json.loads(ARGS.cases.read_text(encoding="utf-8"))
    cases = [c for c in data["cases"] if not ARGS.only or c["kind"] == ARGS.only]
    for i, doc in enumerate(data.get("knowledge", []), 1):
        kb.add_document(i, doc["name"], doc["text"])

    label = llm.model_label()
    print(f"Evaluating {len(cases)} cases on {label}\n")
    rows, started = [], time.time()
    for n, case in enumerate(cases, 1):
        t = time.time()
        try:
            out = process(case["kind"], case["input"], "quick", StepTracker(step_names(case["kind"], "quick"))).output
            checks, error = check(case["kind"], case["expect"], out), None
        except Exception as e:
            out, checks, error = {}, [(f, False, None) for f in case["expect"]], str(e)[:200]
        passed = all(ok for _, ok, _ in checks)
        rows.append({"id": case["id"], "kind": case["kind"], "passed": passed, "seconds": round(time.time() - t, 1),
                     "checks": [{"field": f, "ok": ok, "got": g} for f, ok, g in checks], "error": error,
                     "model": llm.used_label() if not error else None})
        misses = "; ".join(f"{f}={g!r}" for f, ok, g in checks if not ok)
        print(f"[{n:>2}/{len(cases)}] {'PASS' if passed else 'FAIL'}  {case['id']:<20} {rows[-1]['seconds']:>5}s  "
              f"{error or misses}")
        if n < len(cases):
            time.sleep(ARGS.delay)

    summary = {}
    for kind in ("lead", "email", "document"):
        k = [r for r in rows if r["kind"] == kind]
        if k:
            fields = [c for r in k for c in r["checks"]]
            summary[kind] = {"cases": len(k), "passed": sum(r["passed"] for r in k),
                             "field_accuracy": round(100 * sum(c["ok"] for c in fields) / len(fields), 1)}
    total = {"cases": len(rows), "passed": sum(r["passed"] for r in rows),
             "avg_seconds": round(sum(r["seconds"] for r in rows) / max(1, len(rows)), 1),
             "fallback_used": sum(1 for r in rows if r["model"] and r["model"] != label)}
    total["accuracy"] = round(100 * total["passed"] / max(1, total["cases"]), 1)

    print(f"\n{'Kind':<10}{'Passed':>10}{'Field accuracy':>18}")
    for kind, s in summary.items():
        print(f"{kind:<10}{s['passed']:>5}/{s['cases']:<4}{s['field_accuracy']:>16}%")
    print(f"{'TOTAL':<10}{total['passed']:>5}/{total['cases']:<4}   accuracy {total['accuracy']}%   "
          f"avg {total['avg_seconds']}s/case   ({time.time() - started:.0f}s total)")

    out_dir = HERE / "results"
    out_dir.mkdir(exist_ok=True)
    stem = f"{re.sub(r'[^a-z0-9.-]+', '-', label.lower()).strip('-')}-{datetime.now():%Y%m%d-%H%M}"
    report = {"model": label, "date": datetime.now().isoformat(timespec="seconds"), "summary": summary, "total": total, "cases": rows}
    (out_dir / f"{stem}.json").write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    md = [f"# Accuracy: {label}", "", f"{datetime.now():%Y-%m-%d %H:%M} · {total['cases']} cases · quick mode · research off", "",
          "| Kind | Cases passed | Field accuracy |", "|---|---|---|"]
    md += [f"| {k} | {s['passed']}/{s['cases']} | {s['field_accuracy']}% |" for k, s in summary.items()]
    md += [f"| **Total** | **{total['passed']}/{total['cases']} ({total['accuracy']}%)** | |", "",
           f"Average {total['avg_seconds']} s per case.", "", "## Failures", ""]
    fails = [r for r in rows if not r["passed"]]
    md += [f"- `{r['id']}`: " + (r["error"] or ", ".join(f"{c['field']} = {c['got']!r}" for c in r["checks"] if not c["ok"]))
           for r in fails] or ["None."]
    (out_dir / f"{stem}.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"\nReport: eval/results/{stem}.md")

    passed_gate = ARGS.min_accuracy is None or total["accuracy"] >= ARGS.min_accuracy
    if ARGS.summary:
        gate = "" if ARGS.min_accuracy is None else (
            f"\n**{'Passed' if passed_gate else 'Failed'}:** needs at least {ARGS.min_accuracy:g}% "
            f"(got {total['accuracy']}%).\n")
        with ARGS.summary.open("a", encoding="utf-8") as f:
            f.write("\n".join(md) + "\n" + gate)
    if not passed_gate:
        print(f"FAILED: accuracy {total['accuracy']}% is below the required {ARGS.min_accuracy:g}%")
        sys.exit(1)


if __name__ == "__main__":
    main()
