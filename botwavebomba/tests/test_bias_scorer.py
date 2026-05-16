#!/usr/bin/env python3
"""
Fixture-equivalence test for bias_scorer (Path B Week 2).

Asserts:

1. **Deterministic output.** Running bias_scorer.run() twice on the same
   cluster fixture produces byte-equivalent output (modulo dict-iteration
   order, normalised in the signature function).

2. **Schema-valid output.** Every scored cluster validates against
   bias_scorer_output.schema.json.

3. **Carries forward cluster identity.** sources_enriched, bias_variance,
   axis_avg, fp_source_count are added; cluster_id/label/member_hashes
   from the input are preserved unchanged.

4. **Baseline equivalence.** Output matches the captured baseline fixture
   at fixtures/bias_scorer_expected_output.jsonl. Regenerating the baseline
   should be a deliberate commit, not silent drift.

Run:
    python3 zombie760.github.io/botwavebomba/tests/test_bias_scorer.py

Exit 0 on pass.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))

from book_arm.pai_modules.bias_scorer import run as run_scorer  # noqa: E402

FIXTURE_DIR = REPO_ROOT / "zombie760.github.io" / "botwavebomba" / "fixtures"
SCHEMAS_DIR = REPO_ROOT / "zombie760.github.io" / "botwavebomba" / "schemas"

INPUT_FIXTURE = FIXTURE_DIR / "event_clusterer_expected_output.jsonl"  # Week 1's output
EXPECTED_FIXTURE = FIXTURE_DIR / "bias_scorer_expected_output.jsonl"
OUTPUT_SCHEMA = SCHEMAS_DIR / "bias_scorer_output.schema.json"


def _read_jsonl(path: Path) -> list[dict]:
    out = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def _signature(scored: dict) -> tuple:
    """Order-invariant signature for scored cluster equality."""
    return (
        scored["cluster_id"],
        scored["label"],
        frozenset(scored["source_ids"]),
        scored["bias_variance"],
        tuple(sorted(
            (k, v) for k, v in scored["axis_avg"].items()
        )),
        scored["fp_source_count"],
        tuple(sorted(
            (s["id"], s["bias_tier"], s["bias_bucket"], s["bloc"], s["atlanticist_norm"])
            for s in scored["sources_enriched"]
        )),
    )


def _check(condition: bool, msg: str) -> None:
    if not condition:
        print(f"FAIL: {msg}", file=sys.stderr)
        sys.exit(1)


def test_determinism_two_runs_same_output() -> None:
    out_a = REPO_ROOT / ".test_bias_a.jsonl"
    out_b = REPO_ROOT / ".test_bias_b.jsonl"
    try:
        r1 = run_scorer(INPUT_FIXTURE, out_a)
        r2 = run_scorer(INPUT_FIXTURE, out_b)
        _check(r1["output_count"] == r2["output_count"],
               f"output_count differs: {r1['output_count']} vs {r2['output_count']}")
        sigs_a = [_signature(c) for c in _read_jsonl(out_a)]
        sigs_b = [_signature(c) for c in _read_jsonl(out_b)]
        _check(sigs_a == sigs_b, "signatures differ between identical runs")
        print(f"  PASS test_determinism: {r1['output_count']} scored, identical across runs")
    finally:
        for p in (out_a, out_b):
            if p.exists():
                p.unlink()


def test_schema_valid() -> None:
    try:
        import jsonschema
    except ImportError:
        print("  SKIP test_schema_valid: jsonschema not installed")
        return
    schema = json.loads(OUTPUT_SCHEMA.read_text())
    resolver = jsonschema.RefResolver(base_uri=f"file://{SCHEMAS_DIR.as_posix()}/", referrer=schema)
    records = _read_jsonl(EXPECTED_FIXTURE)
    _check(len(records) > 0, "expected_output fixture is empty")
    for r in records:
        jsonschema.validate(instance=r, schema=schema, resolver=resolver)
    print(f"  PASS test_schema_valid: {len(records)} scored clusters all valid")


def test_carries_forward_cluster_identity() -> None:
    inputs = {c["cluster_id"]: c for c in _read_jsonl(INPUT_FIXTURE)}
    outputs = _read_jsonl(EXPECTED_FIXTURE)
    _check(len(inputs) == len(outputs),
           f"count mismatch: input={len(inputs)} output={len(outputs)}")
    for out in outputs:
        ci = out["cluster_id"]
        _check(ci in inputs, f"output cluster_id {ci} not in input")
        inp = inputs[ci]
        for k in ("label", "label_type", "member_hashes", "member_count",
                  "source_ids", "source_count"):
            _check(out[k] == inp[k],
                   f"{ci} field {k} changed between input and output")
    print(f"  PASS test_carries_forward_cluster_identity: {len(outputs)} clusters preserved")


def test_matches_baseline_fixture() -> None:
    out = REPO_ROOT / ".test_bias_baseline.jsonl"
    try:
        run_scorer(INPUT_FIXTURE, out)
        produced = sorted(_signature(c) for c in _read_jsonl(out))
        expected = sorted(_signature(c) for c in _read_jsonl(EXPECTED_FIXTURE))
        _check(produced == expected,
               "produced signatures differ from baseline fixture")
        print(f"  PASS test_matches_baseline_fixture: {len(produced)} scored match baseline")
    finally:
        if out.exists():
            out.unlink()


def main() -> int:
    print("bias_scorer fixture-equivalence test suite")
    print(f"  input fixture: {INPUT_FIXTURE.relative_to(REPO_ROOT)}")
    print(f"  expected: {EXPECTED_FIXTURE.relative_to(REPO_ROOT)}")
    test_carries_forward_cluster_identity()
    test_determinism_two_runs_same_output()
    test_schema_valid()
    test_matches_baseline_fixture()
    print("ALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
