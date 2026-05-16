#!/usr/bin/env python3
"""Fixture-equivalence test for coverage_mapper (Path B Week 5)."""

from __future__ import annotations
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))
from book_arm.pai_modules.coverage_mapper import run as run_cm  # noqa: E402

FX = REPO_ROOT / "zombie760.github.io" / "botwavebomba" / "fixtures"
SCHEMAS = REPO_ROOT / "zombie760.github.io" / "botwavebomba" / "schemas"
INPUT = FX / "blindspot_analyzer_expected_output.jsonl"
EXPECTED = FX / "coverage_mapper_expected_output.jsonl"
SCHEMA = SCHEMAS / "coverage_mapper_output.schema.json"


def _read(p): return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]


def _check(c, m):
    if not c:
        print(f"FAIL: {m}", file=sys.stderr); sys.exit(1)


def test_projection_matches_input_subset():
    inputs = {r["cluster_id"]: r for r in _read(INPUT)}
    outs = _read(EXPECTED)
    for o in outs:
        i = inputs[o["cluster_id"]]
        for k in ("left_pct", "center_pct", "right_pct", "state_count",
                  "dominant_bucket", "dominant_pct"):
            _check(o[k] == i[k], f"{o['cluster_id']} {k} drift: {o[k]} != {i[k]}")
    print(f"  PASS test_projection: {len(outs)} coverage records match blindspot inputs")


def test_schema_valid():
    try: import jsonschema
    except ImportError:
        print("  SKIP test_schema_valid"); return
    s = json.loads(SCHEMA.read_text())
    recs = _read(EXPECTED)
    for r in recs: jsonschema.validate(instance=r, schema=s)
    print(f"  PASS test_schema_valid: {len(recs)} records valid")


def test_determinism():
    a, b = REPO_ROOT / ".test_cm_a.jsonl", REPO_ROOT / ".test_cm_b.jsonl"
    try:
        run_cm(INPUT, a); run_cm(INPUT, b)
        _check(_read(a) == _read(b), "non-deterministic output")
        print(f"  PASS test_determinism: {len(_read(a))} records identical across runs")
    finally:
        for p in (a, b):
            if p.exists(): p.unlink()


def main():
    print("coverage_mapper fixture-equivalence test suite")
    test_projection_matches_input_subset(); test_determinism(); test_schema_valid()
    print("ALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
