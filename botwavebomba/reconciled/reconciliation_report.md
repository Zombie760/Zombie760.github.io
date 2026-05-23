# BOTWAVEBOMBA source reconciliation report

_Generated 2026-05-23T10:58:29+00:00_

## Headline number

- **Canonical unique sources (as written): 1049**
- After collapsing the 24 registry-internal name collisions (49 records → 24 outlets), the defensible floor would be **1024**.
- Registry-only: 441
- API-only: 553
- Merged (in both): 55

**Publish a number in the range 1024–1049. Do NOT publish 244, 6074, or 602.** The internal collisions need editorial review before a single hard number is final.

## Input summary

- Registry (`data/source_registry.json`): 496 entries, 496 unique IDs (slug scheme)
- API (`api/sources.json`): 6074 entries before dedupe, 602 unique IDs after dedupe (hex scheme); 5472 duplicate rows dropped in the canonical output

## Name matching

- Exact-string name overlap across the two files: 41
- Normalized + alias-aware name overlap: 48
- Names that matched only after normalization (alias / case / punctuation / 'The '): 7

## Schema decisions

- Canonical shape inherits the registry schema (axis, bias_legacy, bloc, country, faction_aligned, factuality, factuality_sources, geo_cluster, industry_aligned, notes, parent_company, political_lean, political_lean_sources, primary_vs_launder, provenance, state_aligned).
- API extra fields added to every canonical record (null where unknown): url, source_type, language, mbfc_credibility, bias_western, bias_adversarial, bias_atlanticist, bias_interventionist, bias_statist, bias_financialized, active.
- Two new tracking fields: `merge_origin` (registry|api|merged) and `api_legacy_id` (the original hex id from api/sources.json when known).
- The registry's existing `provenance` field (citation-grade method/source/confidence/date data) was preserved untouched. Origin tracking lives on `merge_origin` to avoid silent overwrite.

## Needs-review tally

- Records flagged for manual review: 611
- Multi-match cases (one registry name → multiple API candidates): 1

## Disagreements found

- Country disagreement (registry vs. API): 12
- Slug collisions resolved with hash suffix: 11
- Registry-internal normalized-name collisions: 24 keys covering 49 registry records
- API records dropped to multi-match (extra API candidates not merged): 1

## Constraints honored

- Originals untouched. Timestamped `.bak.<ISO8601>` copies exist next to each.
- No bias scores invented. API-only sources retain their numeric bias_* but have null axis/political_lean/factuality until editorial review.
- No hardcoded counts carried over from prior meta. All counts recomputed from the merge.
- Dedupe applied only in canonical output. Originals retain their 6074 rows (fixing the append bug is a separate task).

## Files written

- `reconciled/source_registry.canonical.json` (1520085 bytes)
- `reconciled/needs_review.json`
- `reconciled/reconciliation_report.md` (this file)