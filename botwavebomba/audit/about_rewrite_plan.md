# about.html — Rewrite Plan
**Date:** 2026-05-10
**Input:** `audit/about_audit_2026-05-10.md` (27 audited claims; 5 FALSE / 10 PARTIAL / 3 UNVERIFIABLE / 9 TRUE)
**Output target:** new `about.html` describing the actual code, with seven-stage decomposition labeled as in-progress roadmap

---

## Disposition rules

For each non-TRUE claim:
- **cut** — remove entirely; nothing replaces it
- **soften** — rewrite to match what the code actually does (verifiable substitute)
- **roadmap** — keep but explicitly label as future architecture; checkbox shows progress

For TRUE claims: pass through, optionally add a code reference for verifiability.

---

## Per-claim disposition

### What BOTWAVEBOMBA Is — about.html:53-68

| # | Claim | Verdict | Disposition | New copy / treatment |
|---|---|---|---|---|
| C1 | "ingested, scored, clustered, and framing-analyzed" | PARTIAL | soften | *"Every article you see here was ingested by `global_ingestor.py`, clustered across blocs, and tagged with a per-source five-axis bias fingerprint. The pipeline runs every six hours."* Removes "framing-analyzed" (which currently means headline comparison, not deep verb-choice / lexicon analysis). |
| C2 | "244 global news sources" | PARTIAL | soften | Replace with the reconciled phrasing: *"423 sources ingested every six hours. 244 carry full five-axis bias fingerprints. 179 are awaiting fingerprinting and contribute to volume metrics only."* |
| C3 | "updated every six hours" | TRUE | keep | Add code ref: `bomba_pipeline.sh` + `botwave-bomba-pipeline.timer` (OnCalendar 00,06,12,18 UTC). |
| C4 | "Not a news aggregator in the Google News sense" | TRUE | keep | Pass through. |
| C5 | "framing delta engine" | PARTIAL | soften | *"a bloc-level coverage-and-bias comparison engine: which information bloc covered each story, where the volume gaps are, and how each source's bias profile distributes across blocs."* Honest about current scope; "framing delta" upgraded to roadmap when verb-choice/lexicon stages land. |

### Why Not Left / Center / Right? — about.html:70-97

All three claims (C6, C7, C8) are TRUE. Pass through unchanged. Optionally add file:line ref: `data/source_registry.json` per-source `axis` block.

### The TELOS+PAI Pipeline — about.html:99-138 (the heaviest rewrite)

This section becomes two subsections: **What the pipeline does today** and **Decomposition roadmap**.

| # | Original claim | Verdict | Disposition | New treatment |
|---|---|---|---|---|
| C9 | "seven stages" | **FALSE** | soften+roadmap | New framing: *"The pipeline runs in two analytical stages today (ingest → monolith). The seven-stage decomposition is in progress — see the roadmap below."* Then the roadmap is a checkbox list mirroring `pipeline_state.json`. |
| C10 | "global_ingestor.py ... from all 244 sources" | PARTIAL | soften | *"`global_ingestor.py` pulls RSS feeds + article full-text from 423 sources listed in `sources_global.json`, deduplicates by content hash, writes to `news_cache.jsonl`."* Source count corrected. Code ref: `book_arm/pai_modules/global_ingestor.py:53`. |
| C11-C16 | named modules with described behaviors | FALSE/PARTIAL | roadmap | Move all six (event_clusterer, bias_scorer, framing_differ, blindspot_analyzer, coverage_mapper, broadcast) into the roadmap checkbox list. Each entry: *"☐ `<module>.py` — <what it will do when extracted>. Currently bundled in `generate_feed.py`."* The bias_scorer entry is special — see note below. |

**Special note for C12 (bias_scorer):** The standalone module's described behavior (propaganda lexicon + agency-verb + -6 to +6) is NOT what the live pipeline does. The live pipeline does per-source 5-axis lookup. The rewrite must NOT say the lookup IS the scoring; it must be clear that "per-article scoring via lexicon" is a roadmap goal, while "per-source bias lookup" is the current behavior. Two different things, one of which is live and one is future.

### What We Do Not Do — about.html:140-149

Five claims. Four TRUE (C17 dup of C3, C18, C19, C21, C22) — pass through. One UNVERIFIABLE (C20 — MBFC factuality data).

| # | Claim | Verdict | Disposition | New treatment |
|---|---|---|---|---|
| C20 | "We rate source-level factuality patterns using MBFC data" | UNVERIFIABLE | soften | *"Source-level factuality ratings appear in `source_registry.json` (per-source `factuality` field, values: high / mixed / low). The ratings draw on MBFC where available, supplemented by hand-curation. The per-source provenance trace is being documented as part of the methodology audit."* This converts "we use MBFC" (untraceable) into "ratings live here; provenance is in audit" (verifiable). |

### The Journalism Connection — about.html:151-171

| # | Claim | Verdict | Disposition | New treatment |
|---|---|---|---|---|
| C23 | "public surface of a private investigative research substrate" | TRUE | keep | Pass through. |
| C24 | "the same 244-source pipeline ... powers primary-source discovery for book-length investigation" | PARTIAL | soften | *"The same ingest layer (`global_ingestor.py` → `news_cache.jsonl`) feeds both the public site and the book-arm's primary-source discovery for long-form investigation. Both sides consume from the 423-source ingest set."* Source count corrected; ingest-layer-shared claim verified. |

### Bias Scoring Baseline — about.html:173-190

| # | Claim | Verdict | Disposition | New treatment |
|---|---|---|---|---|
| C25 | "Derived from three sources, hand-reconciled: AllSides + MBFC + hand-curation" | UNVERIFIABLE | soften | *"The five-axis fingerprints in `source_registry.json` were hand-curated, drawing on AllSides and MBFC bias ratings where available. Per-source provenance (which axis number for which source came from which input) is not yet machine-traceable — documenting it is on the methodology-audit roadmap."* Honest about the gap. |
| C26 | "Hand-curation methodology: 50+ articles per source + entity framing + state alignment + institutional alignment" | UNVERIFIABLE | cut | The 50+-articles claim has no artifact backing it. Cut entirely. Replace with one line: *"Hand-curation methodology is documented in the methodology audit (see `audit/`); summary not duplicated here to avoid drift."* |
| C27 | "Scores generated 2026-04-23 for the initial 208-source set, extended to 244" | **FALSE** | soften | *"The current registry shipped 2026-05-09 with 244 fingerprinted sources (`source_registry.json#generated_at`). Earlier versions are not preserved in git history."* Drops the unverifiable 208-source / 2026-04-23 history. |
| C28 | "Versioned. Updates logged." | PARTIAL | soften | *"Versioned via git. The current registry was introduced in a single commit (`c6a088bf`); subsequent updates will be logged in `pipeline_state.json` as the registry expands during Phase 2."* |

---

## Canonical source-count phrasing (use everywhere)

When the new page mentions source counts, use this verbatim:

> **423** sources ingested every six hours (`sources_global.json`).
> **244** of those carry full five-axis bias fingerprints (`data/source_registry.json#total`).
> **179** are awaiting fingerprinting and contribute to volume metrics but not per-source bias classification.

Also replace the systemd unit `Description=` field ("317 RSS sources") with "423" as a cosmetic cleanup whenever the unit is next touched. Not blocking.

---

## New section ordering for the rewritten page

1. **What BOTWAVEBOMBA Is** (C1, C4, C5 softened; C2 source count reconciled)
2. **Why Not Left / Center / Right** (C6, C7, C8 kept TRUE)
3. **What The Pipeline Does Today** (the two-stage reality — `global_ingestor` + `generate_feed` monolith — with code refs)
4. **Decomposition Roadmap** (checkbox list mirroring `pipeline_state.json`; the seven-named-modules language goes here, gated as future)
5. **What We Do Not Do** (C17-C22, C20 softened)
6. **The Journalism Connection** (C23 kept, C24 softened on source count)
7. **Bias Scoring Baseline** (C25 softened, C26 cut, C27 softened with new date, C28 softened)
8. **Methodology audit footer** — "Last audit: 2026-05-10. Pipeline decomposition: 0/6 modules extracted. Track progress at `/status.html`. Audit details in `audit/about_audit_2026-05-10.md`."

---

## Code reference style

Every claim that survives the rewrite needs a code reference. Convention:

- Inline code spans for filenames: `<code>generate_feed.py</code>`
- Line references for specific claims: append `<small>(<code>generate_feed.py:291</code>)</small>`
- For files that exist in repo but aren't invoked: tag with `<small style="opacity:0.7;">— standalone module, not currently invoked</small>` so the reader sees the difference between "lives in repo" and "runs in production"

---

## Banner update for Phase 1 Step 3

When the rewrite ships, the audit-in-progress banner from Phase 0 stays but updates:

- **Old (current):** "METHODOLOGY AUDIT IN PROGRESS — week of 2026-05-10. This page is being rewritten line-by-line against the live pipeline."
- **New (after rewrite):** "Last methodology audit: 2026-05-10. Pipeline decomposition: 0/6 modules extracted. Live state: [/status.html](/botwavebomba/status.html). Audit trail: [audit/about_audit_2026-05-10.md](/botwavebomba/audit/about_audit_2026-05-10.md)."

The banner stays amber but loses the "in progress" framing. It becomes a permanent transparency strip showing the page is current with the code.

---

## Acceptance for Phase 1 Step 3

Before declaring the rewrite complete:

- [ ] Read the new page top to bottom as a hostile reader
- [ ] For every factual claim, click through to the code reference. If the link is broken or the line doesn't say what the claim implies, fix or cut.
- [ ] Verify the source-count phrasing is identical everywhere it appears (canonical phrasing above)
- [ ] Verify the decomposition roadmap matches `pipeline_state.json` exactly (same six modules, same status labels)
- [ ] Preserve the original page at `audit/about_original_2026-05-10.html` before overwriting
- [ ] Update the footer with the audit date + decomposition count

---

## What's removed from the page entirely

Two pieces of content do not survive the rewrite at all:

1. **"Pipeline runs in seven stages"** as a present-tense claim. The seven stages become a roadmap, not a current architecture.
2. **The "50+ articles per source" hand-curation methodology detail** (C26). The claim is plausibly true off-machine but has no artifact in the repo. Cut, with a pointer to where the methodology *will* be documented.

Everything else is rewritten or kept, not cut.
