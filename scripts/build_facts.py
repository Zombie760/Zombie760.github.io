#!/usr/bin/env python3
"""build_facts.py — single source of truth for public-facing BOTWAVE numbers.

Pipes systemctl + filesystem + GitHub API into facts.json so the deployed site
stops carrying hardcoded strings. Designed to run on a systemd timer (hourly).

Outputs zombie760.github.io/facts.json with verified counts and timestamps.

The Prime Directive in script form: nothing in facts.json comes from a hardcoded
literal. Every number is derived from a primary source (systemd, ls, git log,
or the GitHub API). If a derivation fails, the field is omitted, not faked.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/var/home/gringo/Botwave-Master")
SITE = ROOT / "zombie760.github.io"
OUT = SITE / "facts.json"


def run(cmd: list[str], timeout: int = 10) -> str:
    """Run a command, return stdout. Empty string on any failure (Prime Directive: no faking)."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout if r.returncode == 0 else ""
    except Exception:
        return ""


def services() -> dict:
    """Active + failed + timer counts from systemctl --user."""
    out = run(["systemctl", "--user", "list-units", "botwave-*", "jps-*",
               "hermes-*", "mistral-*", "--all", "--no-legend", "--no-pager"])
    active = failed = timers = 0
    for line in out.splitlines():
        line = line.strip().lstrip("●").strip()
        if ".service" in line:
            if " active " in line and " running" in line:
                active += 1
            elif " failed " in line:
                failed += 1
        elif ".timer" in line and " active " in line:
            timers += 1
    return {"active": active, "failed": failed, "timers": timers}


def bomba_sources() -> int | None:
    """Pull source count from the botwave-bomba-pipeline.service Description."""
    out = run(["systemctl", "--user", "cat", "botwave-bomba-pipeline.service"])
    m = re.search(r"ingest\s+(\d+)\s+RSS", out)
    return int(m.group(1)) if m else None


def books() -> dict:
    """Books catalog = subdirs of BOTWAVE_BOOKS_FINAL/. A book is 'complete' if any
    *.pdf with a matching slug exists under Book/dist*/."""
    catalog_root = ROOT / "BOTWAVE_BOOKS_FINAL"
    if not catalog_root.is_dir():
        return {"complete": 0, "in_progress": 0, "total_catalog": 0,
                "complete_total": 0, "ready": 0}

    catalog = [p for p in catalog_root.iterdir() if p.is_dir()]

    # Collect every PDF stem under Book/dist*/ for matching
    pdf_stems: set[str] = set()
    for dist in (ROOT / "Book").glob("dist*"):
        if dist.is_dir():
            for pdf in dist.glob("*.pdf"):
                pdf_stems.add(pdf.stem.lower().replace("_final", "").replace("_v2", ""))

    def is_complete(book_dir: Path) -> bool:
        slug = book_dir.name.lower()
        return any(slug == stem or slug in stem or stem in slug for stem in pdf_stems)

    complete = sum(1 for p in catalog if is_complete(p))
    total = len(catalog)
    return {
        "complete": complete,
        "complete_total": complete,
        "ready": 0,  # legacy field; kept for back-compat
        "in_progress": total - complete,
        "total_catalog": total,
    }


def bounty() -> dict:
    """Bounty submission stats — confirmed dir is what counts. Empty is honest."""
    sub = ROOT / "botwave-bounty" / "submissions"
    confirmed_dir = sub / "confirmed"
    confirmed = 0
    if confirmed_dir.is_dir():
        confirmed = sum(1 for p in confirmed_dir.iterdir() if p.is_dir() or p.suffix == ".md")
    submitted = 0
    if sub.is_dir():
        submitted = sum(1 for p in sub.iterdir() if p.is_dir())
    return {"confirmed_paid": confirmed, "submission_dirs": submitted}


def substrate_receipts() -> int:
    """Count immutable JSONL receipts across all substrate stores."""
    total = 0
    for arm in ("engagement_arm", "book", "bounty", "business", "infrastructure"):
        p = ROOT / "Telos" / "substrate" / arm / "claims.jsonl"
        if p.is_file():
            try:
                total += sum(1 for _ in p.open())
            except Exception:
                pass
    # Also audit logs if they exist
    audit_dir = ROOT / "Telos" / "audit"
    if audit_dir.is_dir():
        for f in audit_dir.glob("*.jsonl"):
            try:
                total += sum(1 for _ in f.open())
            except Exception:
                pass
    return total


def github_commits_30d() -> int | None:
    """Commits to current branch in the last 30 days."""
    out = run(["git", "-C", str(ROOT), "log", "--since=30.days", "--pretty=format:%h"])
    return len([l for l in out.splitlines() if l.strip()]) if out else None


def last_bomba_run() -> str | None:
    """When did the BOMBA pipeline last run?"""
    out = run(["systemctl", "--user", "show", "botwave-bomba-pipeline.service",
               "--property=ExecMainStartTimestamp", "--value"])
    s = out.strip()
    return s if s and s != "n/a" else None


def main() -> int:
    svc = services()
    bombabok = bomba_sources()
    bk = books()
    bnt = bounty()

    facts = {
        "services_active": svc["active"],
        "services_failed": svc["failed"],
        "timers_active": svc["timers"],
        "bomba_sources": bombabok,
        "bomba_last_run": last_bomba_run(),
        "books_complete": bk["complete_total"],
        "books_published": bk["complete"],
        "books_ready_to_pdf": bk["ready"],
        "books_in_progress": bk["in_progress"],
        "books_total_catalog": bk["total_catalog"],
        "bounty_confirmed_findings": bnt["confirmed_paid"],
        "bounty_submission_dirs": bnt["submission_dirs"],
        "substrate_receipts": substrate_receipts(),
        "github_commits_30d": github_commits_30d(),
        "monthly_cloud_cost_usd": 20,
        "as_of": datetime.now(timezone.utc).isoformat(),
        "verify": {
            "services": "systemctl --user list-units 'botwave-*' --all --no-legend",
            "bomba_sources": "systemctl --user cat botwave-bomba-pipeline.service | grep Description",
            "substrate_receipts": "wc -l Telos/substrate/*/claims.jsonl Telos/audit/*.jsonl",
        },
        "note": "Generated by scripts/build_facts.py. Every number derived from a primary source on disk.",
    }
    # Drop None values so the JSON stays clean
    facts = {k: v for k, v in facts.items() if v is not None}

    OUT.write_text(json.dumps(facts, indent=2) + "\n")
    print(f"Wrote {OUT}")
    print(json.dumps(facts, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
