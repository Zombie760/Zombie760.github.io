#!/usr/bin/env python3
"""Fixture-equivalence test for framing_differ (Path B Week 3)."""

from __future__ import annotations
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))
from book_arm.pai_modules.framing_differ import run as run_framing  # noqa: E402

FIXTURE_DIR = REPO_ROOT / "zombie760.github.io" / "botwavebomba" / "fixtures"
SCHEMAS_DIR = REPO_ROOT / "zombie760.github.io" / "botwavebomba" / "schemas"

INPUT = FIXTURE_DIR / "bias_scorer_expected_output.jsonl"
NEWS = FIXTURE_DIR / "framing_differ_news_cache.jsonl"
EXPECTED = FIXTURE_DIR / "framing_differ_expected_output.jsonl"
OUT_SCHEMA = SCHEMAS_DIR / "framing_differ_output.schema.json"


def _read(p): return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]


def _sig(f):
    return (f["cluster_id"], f["consensus_hash"], f["consensus_source"],
            f["image_url"], f["video_url"],
            tuple(sorted((c["url"], c["source"], c["snippet"][:80]) for c in f["article_cards"])))


def _check(cond, msg):
    if not cond:
        print(f"FAIL: {msg}", file=sys.stderr); sys.exit(1)


def test_determinism():
    a, b = REPO_ROOT / ".test_fd_a.jsonl", REPO_ROOT / ".test_fd_b.jsonl"
    try:
        run_framing(INPUT, a, NEWS); run_framing(INPUT, b, NEWS)
        _check([_sig(x) for x in _read(a)] == [_sig(x) for x in _read(b)],
               "framing signatures differ across runs")
        print(f"  PASS test_determinism: {len(_read(a))} framed clusters identical")
    finally:
        for p in (a, b):
            if p.exists(): p.unlink()


def test_schema_valid():
    try: import jsonschema
    except ImportError:
        print("  SKIP test_schema_valid: jsonschema missing"); return
    schema = json.loads(OUT_SCHEMA.read_text())
    recs = _read(EXPECTED)
    _check(len(recs) > 0, "empty fixture")
    for r in recs:
        jsonschema.validate(instance=r, schema=schema)
    print(f"  PASS test_schema_valid: {len(recs)} framed clusters valid")


def test_carries_forward_bias_data():
    inputs = {c["cluster_id"]: c for c in _read(INPUT)}
    outs = _read(EXPECTED)
    for o in outs:
        i = inputs[o["cluster_id"]]
        for k in ("bias_variance", "axis_avg", "fp_source_count",
                  "sources_enriched", "source_ids", "member_hashes"):
            _check(o[k] == i[k], f"{o['cluster_id']} field {k} changed")
    print(f"  PASS test_carries_forward_bias_data: {len(outs)} clusters preserved")


def test_baseline():
    o = REPO_ROOT / ".test_fd_base.jsonl"
    try:
        run_framing(INPUT, o, NEWS)
        produced = sorted(_sig(x) for x in _read(o))
        expected = sorted(_sig(x) for x in _read(EXPECTED))
        _check(produced == expected, "framing signatures differ from baseline")
        print(f"  PASS test_baseline: {len(produced)} clusters match baseline")
    finally:
        if o.exists(): o.unlink()


def main():
    print("framing_differ fixture-equivalence test suite")
    test_carries_forward_bias_data()
    test_determinism()
    test_schema_valid()
    test_baseline()
    print("ALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
