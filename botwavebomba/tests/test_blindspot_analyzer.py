#!/usr/bin/env python3
"""Fixture-equivalence test for blindspot_analyzer (Path B Week 4)."""

from __future__ import annotations
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))
from book_arm.pai_modules.blindspot_analyzer import run as run_bs  # noqa: E402

FX = REPO_ROOT / "zombie760.github.io" / "botwavebomba" / "fixtures"
SCHEMAS = REPO_ROOT / "zombie760.github.io" / "botwavebomba" / "schemas"
INPUT = FX / "framing_differ_expected_output.jsonl"
NEWS = FX / "blindspot_analyzer_news_cache.jsonl"
EXPECTED = FX / "blindspot_analyzer_expected_output.jsonl"
SCHEMA = SCHEMAS / "blindspot_analyzer_output.schema.json"


def _read(p): return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]


def _sig(r):
    return (r["cluster_id"], r["left_pct"], r["center_pct"], r["right_pct"],
            r["state_count"], r["dominant_bucket"], r["dominant_pct"],
            r["is_blindspot"], r["blindspot_side"], r["blindspot_score"],
            r["blindspot_label"], r["geo_frame"], r["geo_frame_label"],
            r["geo_frame_topic"], tuple(sorted(r["geo_breakdown"].items())))


def _check(c, m):
    if not c:
        print(f"FAIL: {m}", file=sys.stderr); sys.exit(1)


def test_determinism():
    a, b = REPO_ROOT / ".test_bs_a.jsonl", REPO_ROOT / ".test_bs_b.jsonl"
    try:
        run_bs(INPUT, a, news_cache_path=NEWS); run_bs(INPUT, b, news_cache_path=NEWS)
        _check([_sig(x) for x in _read(a)] == [_sig(x) for x in _read(b)], "non-deterministic")
        print(f"  PASS test_determinism: {len(_read(a))} blindspots identical")
    finally:
        for p in (a, b):
            if p.exists(): p.unlink()


def test_schema_valid():
    try: import jsonschema
    except ImportError:
        print("  SKIP test_schema_valid"); return
    s = json.loads(SCHEMA.read_text())
    recs = _read(EXPECTED)
    for r in recs: jsonschema.validate(instance=r, schema=s)
    print(f"  PASS test_schema_valid: {len(recs)} records valid")


def test_baseline():
    o = REPO_ROOT / ".test_bs_base.jsonl"
    try:
        run_bs(INPUT, o, news_cache_path=NEWS)
        _check(sorted(_sig(x) for x in _read(o)) == sorted(_sig(x) for x in _read(EXPECTED)),
               "baseline mismatch")
        print(f"  PASS test_baseline: {len(_read(o))} records match")
    finally:
        if o.exists(): o.unlink()


def main():
    print("blindspot_analyzer fixture-equivalence test suite")
    test_determinism(); test_schema_valid(); test_baseline()
    print("ALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
