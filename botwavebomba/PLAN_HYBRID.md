# BOTWAVEBOMBA — HYBRID Game Plan

**Status:** STALE_BUT_HEALTHY → Recovery via RELABEL + REPAIR
**Owner:** Kyle Jimenez (Botwave / TELOS+PAI)
**Plan date:** 2026-05-10
**Target completion:** ~7 weeks from start

---

## Table of Contents

1. [Why This Plan Exists](#why-this-plan-exists)
2. [Diagnostic Recap](#diagnostic-recap)
3. [Strategic Posture](#strategic-posture)
4. [The Three Phases](#the-three-phases)
5. [Phase 0 — Today (Stop the Bleeding)](#phase-0--today-stop-the-bleeding)
6. [Phase 1 — This Week (RELABEL)](#phase-1--this-week-relabel)
7. [Phase 2 — Weekly Cadence (REPAIR)](#phase-2--weekly-cadence-repair)
8. [Acceptance Standards](#acceptance-standards)
9. [Risk Register & Stop Conditions](#risk-register--stop-conditions)
10. [Drift Protection](#drift-protection)
11. [Definitions of Done](#definitions-of-done)
12. [Appendix A — Per-Week Module Briefs](#appendix-a--per-week-module-briefs)
13. [Appendix B — Paste-Ready Prompts](#appendix-b--paste-ready-prompts)
14. [Appendix C — Reference Schemas](#appendix-c--reference-schemas)

---

## Why This Plan Exists

BOTWAVEBOMBA's public methodology page describes a seven-stage TELOS+PAI
pipeline running every six hours against 244 sources. The diagnostic verdict
of 2026-05-10 found that the pipeline is alive and producing fresh data, but
the architecture described on `about.html` is not the architecture in the
code. The code runs as a two-stage flow (`global_ingestor.py` →
`generate_feed.py` monolith), with the analytical sub-stages bundled inside
the monolith rather than existing as the discrete `bias_scorer.py`,
`framing_differ.py`, etc., that the page names.

This is the gap a hostile reader exploits. The site's tagline is
**BE UNDENIABLE**. A methodology page that overclaims its own architecture
is the most dismissible thing the site can publish — especially on a topic
(adversarial framing, RT/IRNA/Sputnik in the index) where the audience is
already primed to assume the operator is bullshitting.

The plan closes that gap in two motions: **relabel the page to match the
code** (this week), then **build the code to match the original page** (one
module per week, six weeks, until the monolith is fully decomposed).

---

## Diagnostic Recap

### What's working
- `botwave-bomba-pipeline.timer` is active. Fired four times on 2026-05-10
  (01:24, 07:23, 15:52, 19:23 UTC).
- Each run pushes a fresh `api/latest.json`: 11,812 articles, 160 stories,
  current date.
- GitHub Pages serves `api/*.json` correctly under the project subpath. No
  fetch-routing bug.
- Em-dashes on the live site are pre-render placeholders, not failures.

### What's broken or misleading
- **`api/blindspots.json` is a one-shot fossil.** Committed once on
  `4a55450`. Never regenerated. No script writes to it. The renderer has a
  fallback (derive from `latest.json`) but it never fires because the stale
  file returns 200 with non-empty data.
- **`_demoPayload()` ships fictional Reuters/RT/IRNA stories** as a silent
  fallback when the data fetch fails. On a bad pipeline day, the live site
  shows fake stories with no error indication. This is a credibility
  P0 — a single screenshot of a fabricated Reuters byline ends the project.
- **Methodology overclaim on `about.html`:**
  - Claims "seven stages" + named scripts (`broadcast.py`,
    `bias_scorer.py`, `framing_differ.py`, etc.). Reality: pipeline is
    two stages — `global_ingestor.py` → `generate_feed.py` (monolith).
    The named modules exist as files in `book_arm/pai_modules/` but are
    not invoked.
  - Source counts are inconsistent: 423 ingested vs 244 bias-rated vs
    317 referenced in unit description. Three different numbers.
  - "Updated every six hours by systemd timer" is true.
  - "AllSides + MBFC + hand-curated TELOS+PAI fingerprints" — present
    in the data, methodology of reconciliation underdocumented.

### Verdict
**STALE_BUT_HEALTHY.** Pipeline runs. Methodology page lies. Fix in two
motions, in this order: relabel, then repair.

---

## Strategic Posture

This plan inherits the same epistemic standard as the RECORD pipeline that
vetted *They're Too Busy Marrying Themselves*: **primary source every time,
cannot-verify as a first-class output, the methodology is falsifiable on
its face.**

Translated to BOTWAVEBOMBA:

1. **No claim on `about.html` ships without a code reference.** If you
   can't point to a file and line, the claim doesn't go on the page.
2. **System state is part of the methodology.** A public `/status.html`
   showing live pipeline health is non-negotiable. Visitors don't have to
   trust the methodology page; they can check it.
3. **Failures fail loud.** No silent fallback to fictional content, ever.
   When data is unavailable, the site says so plainly.
4. **The audit trail is public.** A footer date on `about.html` shows when
   methodology claims were last verified against code. Decomposition
   progress is visible at `/status.html`.

The forcing function is the same one CHANGES.md provides for the
manuscript: the audit trail is so visible that drift becomes shameful.

---

## The Three Phases

| Phase | Duration | Outcome |
|-------|----------|---------|
| **Phase 0 — Today** | 30–60 minutes | Site can no longer produce a fake-Reuters screenshot. Blindspots page works. About.html announces its own audit. |
| **Phase 1 — This Week** | 4–8 hours total | `about.html` matches the code. `/status.html` exists publicly. The lie is gone. |
| **Phase 2 — Weekly Repair** | 6 weeks (one module per week) + 1 week orchestrator = ~7 weeks | Monolith fully decomposed. Methodology page becomes documentary instead of aspirational. |

After Phase 2, BOTWAVEBOMBA's methodology page describes the actual
architecture, every named stage exists as a discrete testable module,
`/status.html` reports per-stage health, and the entire promise of
**BE UNDENIABLE** is structurally verifiable by any visitor.

---

## Phase 0 — Today (Stop the Bleeding)

**Total time:** 30–60 minutes
**Total commits:** 3
**Branch:** `fix/honest-fallbacks`

These are sequenced. Don't reorder. Each commit reduces a discrete
credibility risk before the next one.

### Commit 1 — Kill the fictional fallback (P0)

**Goal:** make it structurally impossible for the live site to display
fabricated Reuters/RT/IRNA stories.

**Files changed:**
- `botwavebomba/js/api.js` (or wherever `_demoPayload()` lives)
- The renderer that consumes the payload

**Tasks:**
- [x] Remove all hardcoded fictional articles from `_demoPayload()`
- [x] Replace return value with an error object:
      `{ error: "pipeline_unreachable", last_known_good: <ISO timestamp>, message: "Pipeline data temporarily unavailable. Last successful update: <timestamp>." }`
- [x] Update the renderer to detect the error object and display a banner
      instead of attempting to render stories
- [x] Banner must be visually distinct (yellow or red), not blend with
      normal UI
- [ ] If demo content is needed for local development, gate it behind
      `window.location.hostname === 'localhost'` AND a `?demo=1` URL
      parameter. Both required, not either.
- [ ] Test by temporarily breaking the fetch URL in dev tools — confirm
      banner appears, no fictional stories render
- [ ] Test by visiting with neither localhost nor `?demo=1` — confirm no
      demo content is reachable through any code path

**Commit message:**
```
fix(api): replace _demoPayload with fail-loud error state

Removes hardcoded fictional Reuters/RT/IRNA fallback stories that
could ship to production on a failed fetch. Replaces with explicit
error banner showing last-known-good timestamp. Demo content now
gated behind localhost+?demo=1 for local dev only.
```

**Acceptance:** Break the fetch URL in browser dev tools. Confirm the
site shows an error banner with the last-good timestamp, never a story
card. Reload. Confirm same behavior. Inspect bundle for any remaining
hardcoded story strings — there should be none.

---

### Commit 2 — Delete the blindspots fossil

**Goal:** remove the stale `blindspots.json` so the existing renderer
fallback (derive from `latest.json`) starts firing on the 6-hour cycle.

**Files changed:**
- `botwavebomba/api/blindspots.json` (deleted)
- Possibly `js/blindspot.js` if the fallback has a latent bug

**Tasks:**
- [x] `git rm botwavebomba/api/blindspots.json`
- [ ] Local server up: `python3 -m http.server 8000` from repo root
- [ ] Open `http://localhost:8000/botwavebomba/blindspots.html`
- [ ] Confirm the fallback fires (404 on blindspots.json triggers the
      derive-from-latest path)
- [ ] Confirm real blindspots render, derived from the 160 stories in
      `latest.json`
- [ ] If the fallback has a latent bug (estimate: 30% chance — the
      fossil may have been masking it), fix it in this same commit
- [ ] Sanity check: are the derived blindspots actually meaningful? If
      every blindspot looks identical or all blocs show as covering
      everything, the derivation logic itself needs work — but defer
      that to a future commit unless it's egregious

**Commit message:**
```
fix(blindspots): remove stale blindspots.json fossil

The api/blindspots.json file was committed once on 4a55450 and never
regenerated. No script writes to it. The renderer's fallback path
(derive from latest.json) never fired because the stale file returned
200. Removing the fossil enables the fallback and picks up the 6-hour
refresh cycle.
```

**Acceptance:** `/blindspots.html` shows blindspots that update with
the pipeline cycle. The blindspots reference real stories from
`latest.json`. No 200 response when curling
`/botwavebomba/api/blindspots.json` (should 404 cleanly).

---

### Commit 3 — Honest banner on about.html

**Goal:** put a one-line truth-telling banner on the methodology page
*before* the rewrite, so the page is not silently overclaiming during
the audit week.

**Files changed:**
- `botwavebomba/about.html`

**Tasks:**
- [x] Add a banner element near the top of `about.html`, above "What
      BOTWAVEBOMBA Is"
- [x] Banner text: *"Methodology audit in progress (week of 2026-05-10).
      Page is being rewritten line-by-line against the live pipeline.
      Live pipeline state: [/status.html — coming this week]."*
- [ ] Visually distinct (light yellow background, dark text, clear
      border) — CURRENTLY DARK RED, NEEDS RECOLOR
- [x] Persistent — not dismissible. The banner stays until the audit is
      complete and is replaced with a "Last methodology audit: [date]"
      footer
- [x] Link to `/status.html` should be present even though the page
      doesn't exist yet — it will exist this week. If you want, leave
      the link inert (no href) until status.html ships, then update.
      Either way, name it explicitly.

**Commit message:**
```
docs(about): add transparency banner during methodology audit

Methodology page makes claims that don't currently match the code
(seven discrete stages described, monolith in reality). Banner
announces the audit-and-rewrite work happening this week. Removes
the worst version of the discrepancy (silent overclaim) by replacing
it with a documented one (audit in progress).
```

**Acceptance:** `/about.html` displays the banner above all other
content. Banner is visually distinct. Banner mentions `/status.html`
and the audit week explicitly.

---

### Phase 0 exit criteria

All three commits merged to main and pushed. Live site verified:

- [x] `/index.html` — fetch failure produces error banner, never fake stories
- [x] `/blindspots.html` — shows real, derived blindspots (404 on file confirmed)
- [x] `/about.html` — banner visible at top, mentions audit and `/status.html`
- [x] `git log --oneline -5` shows the commits (bundled into `087dcbd` not three separate — recoverable)
- [x] No `_demoPayload()` strings in production bundle (`grep` the dist)

---

## Phase 1 — This Week (RELABEL)

**Total time:** 4–8 hours, spread across the week
**Total commits:** ~5–10 small commits
**Branch:** `relabel/methodology-audit`

The week's deliverables: `about.html` matches the code, `/status.html`
exists publicly, the lie is gone.

### Step 1 — Methodology audit (2–3 hours)

This is a discovery task, not a writing task. Output: a markdown audit
file with one row per claim on `about.html`, marked against the actual
code.

**Workflow:**
- [ ] Start a fresh audit session in the botwavebomba repo
- [ ] Paste the audit prompt from Appendix B
- [ ] Agent produces `about_audit.md` with columns: claim, verdict
      (TRUE/PARTIAL/FALSE/UNVERIFIABLE), evidence (file:line)
- [ ] Review every row personally. The agent should not be trusted to
      mark TRUE without you spot-checking the file:line reference
- [ ] Commit `about_audit.md` to the repo. This file is itself part of
      the audit trail.

**Output:** `botwavebomba/audit/about_audit_2026-05-10.md`

**Commit message:**
```
audit(about): line-by-line methodology audit against bomba_pipeline.sh

Every factual claim in about.html marked TRUE/PARTIAL/FALSE/
UNVERIFIABLE with file:line evidence. Source for the rewrite plan.
```

---

### Step 2 — Rewrite plan (1 hour)

Given the audit, decide what to do with each FALSE/PARTIAL/UNVERIFIABLE
claim. Three options per claim:

1. **Cut it** — remove the claim entirely
2. **Soften it** — rewrite to match what the code actually does
3. **Move it to roadmap** — keep the claim but explicitly label it as
   future architecture, not current

Output: `about_rewrite_plan.md` with the same row-per-claim structure,
now with a "Disposition" column.

**Tasks:**
- [ ] For every FALSE row in the audit: pick cut/soften/roadmap
- [ ] For every PARTIAL row: write the corrected version
- [ ] For every UNVERIFIABLE row: either find evidence (promote to
      TRUE) or treat as FALSE
- [ ] Reconcile the source counts: produce one canonical phrasing.
      Recommended: *"423 sources ingested. 244 currently carry full
      five-axis bias fingerprints. 179 are awaiting fingerprinting and
      contribute to volume metrics but not framing analysis."*
- [ ] Architecture description: rewrite the "TELOS+PAI Pipeline"
      section to describe the two-stage reality, with the seven-stage
      decomposition explicitly labeled as in-progress

**Commit message:**
```
plan(about): rewrite plan derived from methodology audit
```

---

### Step 3 — Execute the rewrite (1–2 hours)

Now write the new `about.html`. Rules:

- [ ] Every claim has a code reference (visible to readers as a small
      `<code>` link or hover tooltip — not just in the source)
- [ ] Source counts use the canonical phrasing from Step 2
- [ ] Architecture section describes monolith reality + decomposition
      roadmap. Roadmap is clearly labeled. Roadmap stages are
      checkboxes that will fill in as Phase 2 ships them.
- [ ] Footer adds: *"Last methodology audit: 2026-05-10. Pipeline
      decomposition: 0/6 modules extracted. Track progress at
      /status.html."*
- [ ] Banner from Phase 0 Commit 3 is updated: it stays as a banner
      pointing to `/status.html`, but the "audit in progress" text is
      replaced with "Last audit: 2026-05-10. Live state: /status.html"
- [ ] Do not delete the original methodology language entirely —
      preserve it in `audit/about_original_2026-05-10.html` so the
      rewrite is reversible and the historical record exists
- [ ] Test: read the new page top to bottom as a hostile reader. Find
      one claim you can't immediately verify in the linked code. Cut it.

**Commit message:**
```
docs(about): rewrite methodology page to match live pipeline

Methodology page now describes the actual two-stage architecture
(global_ingestor + generate_feed monolith) with the seven-stage
decomposition labeled as in-progress roadmap. Source counts
reconciled (423 ingested / 244 fingerprinted / 179 pending).
Every claim references file:line in the code. Original page
preserved in audit/.
```

---

### Step 4 — Build /status.html v1 (2–3 hours)

Minimal, public, reads from real data. Not theater.

**Files created:**
- `botwavebomba/status.html`
- `botwavebomba/js/status.js`
- (No new API endpoint required for v1)

**Data sources for v1:**
- Last successful pipeline run: `mtime` of `api/latest.json` (or a
  timestamp inside the file if available)
- Article count: derive from `latest.json` length
- Story count: derive from `latest.json` clusters
- Source counts (423/244/179): pull from the source registry file at
  runtime, not hardcoded
- Decomposition progress: a static JSON file
  `botwavebomba/pipeline_state.json` with `{ "modules_extracted": 0,
  "total_modules": 6, "stages": [...] }` — updated manually each week
  in Phase 2

**Display:**
- [ ] Last successful run: timestamp + relative time ("3 hours ago")
- [ ] Pipeline status: green dot if mtime < 8 hours, yellow if 8–24
      hours, red if > 24 hours
- [ ] Source counts table with all three numbers and one-line
      definitions
- [ ] Decomposition progress: 6 stages listed, each marked
      "monolith" / "extracted" / "in progress". Visual progress bar.
- [ ] Last methodology audit date (read from a JSON file or hardcoded
      until automated)
- [ ] Failure states are explicit, not red text in green sea — yellow
      banner for degraded, red banner for failed
- [ ] Auto-refresh every 60 seconds
- [ ] Linked from: `about.html` banner, site footer

**Tasks:**
- [ ] Build the page with stub data first
- [ ] Wire to real `api/latest.json` and `pipeline_state.json`
- [ ] Verify the freshness logic: artificially set `latest.json` mtime
      to 12 hours ago, confirm yellow; 26 hours ago, confirm red
- [ ] Add link from `about.html` banner (replace the inert link from
      Phase 0)
- [ ] Add link in site footer

**Commit messages:**
```
feat(status): add /status.html v1 — public pipeline health page
docs(about): wire about.html banner to live status.html
```

**Acceptance:** Loading `/status.html` from the live site shows the
correct article count, story count, last-run timestamp, and source
counts. Decomposition progress shows 0/6 modules extracted (correct
for end of Phase 1). Page auto-refreshes every 60 seconds without
hard reload.

---

### Phase 1 exit criteria

- [ ] `about.html` rewritten, every claim has a code reference, source
      counts reconciled
- [ ] Original `about.html` preserved in `audit/`
- [ ] `about_audit_2026-05-10.md` and `about_rewrite_plan.md` committed
- [ ] `/status.html` is public, reads real data, shows 0/6 decomposition
- [ ] About.html banner now points to live `/status.html`
- [ ] Site footer links to `/status.html`
- [ ] One full pipeline cycle (6 hours) elapsed since rewrite — verify
      `/status.html` shows the new run timestamp correctly

After Phase 1, BOTWAVEBOMBA's public methodology page is documentary.
Phase 2 builds the architecture the page now honestly describes as
in-progress.

---

## Phase 2 — Weekly Cadence (REPAIR)

**Total duration:** 7 weeks (6 module extractions + 1 orchestrator week)
**Per-week budget:** ~4–6 hours, one focused session
**Branch pattern:** `path-b/week-N-<module>` per week

The work: extract one analytical stage from `generate_feed.py` into a
discrete module per week. Same per-week pattern every time. Six modules,
six weeks. Then one week for the orchestrator that replaces the
monolith.

### The non-negotiable extraction order

| Week | Module | Why this order | Parallel-safe? |
|------|--------|----------------|----------------|
| 1 | `event_clusterer.py` | First stage after ingestor. Clean input contract (`news_cache.jsonl` exists). No dependencies. | No |
| 2 | `bias_scorer.py` | Consumes clusterer output. Five-axis scoring is well-defined logic. | No |
| 3 | `framing_differ.py` | Consumes scored output. Smaller scope than cluster/bias. | No |
| 4 | `blindspot_analyzer.py` | Pure analysis, consumes framings. | Yes, with week 5 |
| 5 | `coverage_mapper.py` | Pure analysis, consumes framings. | Yes, with week 4 |
| 6 | `broadcast.py` | Mechanical serializer once everything else is modular. | No |
| 7 | `run_pipeline.py` | Orchestrator. Replaces `generate_feed.py`. Renames it `.legacy.py`. | No |

Weeks 4 and 5 are technically parallel-safe (both consume `framings.jsonl`,
neither depends on the other) but the per-week cadence still applies — do
them in calendar weeks 4 and 5, not the same week. The pacing is the
protection, not the dependency graph.

---

### The Per-Week Pattern

Every week from week 1 through week 6 follows this exact loop. Do not
deviate. The repetition is what makes the cadence sustainable and the
shadow runs trustworthy.

#### Monday morning — Setup (30 min)

- [ ] `git checkout main && git pull`
- [ ] `git checkout -b path-b/week-N-<module>`
- [ ] Open `generate_feed.py` and find the section that does the work
      this module will own
- [ ] Read it top to bottom. Note any helper functions called, any
      shared state mutated, any I/O performed
- [ ] If the section is more entangled than expected (depends on
      multiple internal helpers), STOP. Schedule the helper extraction
      for this week instead. Real module extraction slips to next
      week. **The pacing is sacred.**

#### Monday afternoon — Extract (2–3 hours)

- [ ] Create `botwavebomba/pai_modules/<module>.py`
- [ ] Define module signature: `def run(input_path: Path, output_path: Path) -> RunResult`
- [ ] Copy the analytical logic from `generate_feed.py` verbatim. **Do
      not improve it.** This is a refactor, not a rewrite.
- [ ] Define input schema:
      `botwavebomba/schemas/<module>_input.schema.json`
- [ ] Define output schema:
      `botwavebomba/schemas/<module>_output.schema.json`
- [ ] Add schema validation on entry and exit. Fail loud (raise) on
      violation, never silent.
- [ ] Add structured logging at start and end:
      `logger.info({"stage": "<module>", "input_count": N, "output_count": M, "duration_ms": T, "schema_valid": True})`

#### Tuesday — Test (2 hours)

- [ ] Extract a fixture from a real recent run: small, real,
      representative. Save to `botwavebomba/fixtures/<module>_input.jsonl`
- [ ] Run the original monolith on the same input fixture. Capture the
      relevant output section. Save to
      `botwavebomba/fixtures/<module>_expected_output.jsonl`
- [ ] Run the new module on the input fixture. Compare output to
      expected.
- [ ] **Fixture-equivalence test:** new module output must match the
      monolith output for the same input. Allow for nondeterministic
      ordering (sort before compare) but not for content differences.
- [ ] If outputs differ, the bug is in the extraction. Fix it. Do not
      proceed until equivalence holds.
- [ ] Write the test as `tests/test_<module>.py` so it runs in CI

#### Wednesday — Wire loosely (1 hour)

The monolith stays running. We just make it delegate this stage to the
new module instead of doing it inline.

- [ ] In `generate_feed.py`, find the section the new module replaces
- [ ] Replace it with:
      ```python
      from pai_modules.<module> import run as <module>_run
      <module>_run(input_path, output_path)
      ```
- [ ] Run the full pipeline locally. Compare `api/latest.json` and
      `api/blindspots.json` outputs to the previous run on the same
      input. Should be identical (modulo nondeterminism).
- [ ] Push to a staging branch. Do not merge to main yet.

#### Thursday — Shadow run (zero-touch, 24 hours)

- [ ] Deploy the staging branch to a staging GitHub Pages location, or
      run the new pipeline on the production server with output
      redirected to `api-staging/*.json`
- [ ] Wait one full 6-hour cycle. Compare `api-staging/latest.json`
      to `api/latest.json` produced by the unchanged production
      pipeline.
- [ ] If outputs match (or match modulo ordering), the extraction is
      verified.
- [ ] If outputs diverge, find the divergence. Do not merge until
      resolved. The monolith is the spec; the new module must match.

#### Friday — Merge and document (1 hour)

- [ ] `git checkout main && git pull`
- [ ] `git merge path-b/week-N-<module>`
- [ ] Push to main. The pipeline now uses the new module via the
      monolith's delegation.
- [ ] Update `botwavebomba/pipeline_state.json`:
      - Increment `modules_extracted`
      - Mark this stage as `"extracted"` in the stages array
- [ ] Update `botwavebomba/about.html`:
      - Flip this stage from "bundled in monolith" to "discrete
        module" with the file reference
      - Update the audit-date footer
- [ ] Verify `/status.html` reflects the change (decomposition
      progress increments)
- [ ] Close the week.

#### Saturday/Sunday — Off

The plan is sustainable only if weekends stay weekends. The shadow run
runs unattended Thursday into Friday. Friday is the merge day. Weekend
is rest. If a week's work slips into the weekend, slip the next
week's extraction by one week — do not stack.

---

### Per-week acceptance gate

A week's work is "done" only when ALL of these are true:

- [ ] New module exists at `pai_modules/<module>.py`
- [ ] Module has input + output JSON schemas
- [ ] Module validates schemas on entry and exit, fails loud
- [ ] Fixture-equivalence test passes (new == monolith for same input)
- [ ] Test runs in CI and passes
- [ ] `generate_feed.py` delegates to the new module
- [ ] One full 6-hour shadow run produced equivalent output
- [ ] `pipeline_state.json` updated
- [ ] `about.html` updated to reflect the new module
- [ ] `/status.html` shows updated decomposition progress
- [ ] Monolith (`generate_feed.py`) still works as fallback if needed

If any item is false, the week is not done. Slip rather than ship.

---

### Week 7 — Orchestrator

After all six modules are extracted, the monolith is mostly a glue
script. Week 7 replaces it with a proper orchestrator.

**Branch:** `path-b/week-7-orchestrator`

**Files created:**
- `botwavebomba/run_pipeline.py` — orchestrator
- `botwavebomba/schemas/pipeline_run.schema.json` — run-record schema (already drafted 2026-05-10 — see `schemas/pipeline_run.schema.json`)

**Files renamed:**
- `botwavebomba/generate_feed.py` → `botwavebomba/generate_feed.legacy.py`

**Tasks:**
- [ ] Build `run_pipeline.py` that imports each stage module and runs
      them in dependency order:
      1. `global_ingestor` (existing, unchanged)
      2. `event_clusterer`
      3. `bias_scorer`
      4. `framing_differ`
      5. `blindspot_analyzer` and `coverage_mapper` (concurrent, via
         `concurrent.futures`)
      6. `broadcast`
- [ ] Each stage's run gets a record in `pipeline_run.json`:
      timestamp, duration, input_count, output_count, schema_valid,
      success/failure
- [ ] If any stage fails, the orchestrator stops cleanly and writes
      the failure to `pipeline_run.json`. The previous good
      `api/*.json` stays in place — failures do not corrupt the live
      site.
- [ ] Update `bomba_pipeline.sh` to invoke
      `python -m botwavebomba.run_pipeline` instead of
      `generate_feed.py`
- [ ] Rename `generate_feed.py` to `generate_feed.legacy.py`. Do not
      delete. Keep as rollback insurance for one release cycle.
- [ ] Update `/status.html` to read from `pipeline_run.json` instead
      of inferring from `api/latest.json` mtime. Now status is real
      per-stage health, not just "pipeline produced output recently".
- [ ] Final `about.html` rewrite: pipeline section now describes seven
      discrete modules, references each file, no roadmap caveats.
      Footer audit date updated.
- [ ] Two full 6-hour cycles of shadow run before merging to main.

**Acceptance for Week 7:**
- [ ] Orchestrator runs end-to-end on staging with fresh data
- [ ] `pipeline_run.json` produced and schema-valid
- [ ] `/status.html` reads from `pipeline_run.json` and shows real
      per-stage health
- [ ] `about.html` describes seven discrete modules, all references
      verifiable
- [ ] `generate_feed.legacy.py` exists as rollback
- [ ] Two clean shadow cycles before merge

After Week 7: BOTWAVEBOMBA's methodology page describes the actual
architecture. Every claim is structurally verifiable. The code matches
the page. **BE UNDENIABLE** is no longer aspirational.

---

## Acceptance Standards

These apply to every commit, every week, every phase. Not aspirational —
the standard.

### Code

- **No silent failures.** Every error path either logs structured data
  and surfaces to UI, or raises. Catch-and-continue is banned.
- **Schema validation on stage boundaries.** Every input is validated
  on entry, every output on exit. Schema violations raise.
- **Fixture-equivalence is the spec.** A new module is correct iff it
  produces equivalent output to the monolith on the same input.
- **No hardcoded counts, sources, or dates.** All such values come from
  files at runtime.

### Docs

- **No claim without a code reference.** Every factual statement on
  `about.html` points to a file:line.
- **Audit dates are public.** `about.html` footer shows the last
  methodology audit date. `/status.html` shows the last pipeline run.
- **Originals preserved.** Rewrites move the old version to `audit/`
  with the date in the filename. Reversibility matters.

### Process

- **One module per week. Pacing is protection.** No stacking, no
  catching up, no parallel extraction. If a week slips, the next week
  slips with it.
- **Shadow runs are mandatory.** No module merges to main without one
  full 6-hour cycle of equivalent staging output. Week 7 requires two.
- **Weekly state updates.** `pipeline_state.json` and `about.html`
  update every Friday. Visitors see the cadence.

---

## Risk Register & Stop Conditions

### Risks

**R1 — Module extraction reveals deep entanglement.**
*Probability:* Medium. *Impact:* Schedule slip.
*Mitigation:* Built into the per-week pattern — Monday morning includes
a "stop and reassess" gate. If a module is more entangled than expected,
extract the helpers first as the week's work and slip the module to the
following week. Pacing is sacred.

**R2 — Fixture-equivalence test fails for valid reasons.**
*Probability:* Medium. *Impact:* Forces deeper investigation.
*Mitigation:* Some divergence is benign (timestamp differences,
nondeterministic dict ordering). Build the test to normalize for these.
Real divergence (different scores, different cluster memberships) is the
bug, find it.

**R3 — Shadow run produces different output than production.**
*Probability:* Low. *Impact:* High — indicates the extraction is wrong.
*Mitigation:* Do not merge. Do not push. Find the divergence. The
monolith is the spec.

**R4 — Drift: skipping weeks, then forgetting the pattern.**
*Probability:* High if not actively managed. *Impact:* Plan dies on the
vine, methodology page becomes stale again.
*Mitigation:* See [Drift Protection](#drift-protection) section.

**R5 — Pipeline failure during the audit week makes /status.html show
red.**
*Probability:* Low. *Impact:* Visible but recoverable.
*Mitigation:* This is fine. A red status is honest. The point of
`/status.html` is that it reflects reality. If the pipeline breaks, the
page says so. That is the feature, not a bug.

**R6 — A weekly module ships with a subtle bug that corrupts
api/latest.json.**
*Probability:* Low (shadow runs catch most cases). *Impact:* High.
*Mitigation:* Keep `generate_feed.legacy.py` for one release cycle
after Week 7. If a regression appears post-orchestrator, rollback is
one shell-script edit.

### Stop conditions

Halt the plan and reassess if any of these occur:

- **A weekly extraction takes more than 8 hours of focused work.** The
  module is harder than expected; the pacing assumption is wrong. Stop,
  re-scope, possibly split into two weeks.
- **Two consecutive weeks slip.** The cadence is broken. Either reduce
  scope or pause the plan and address whatever's eating the time.
- **A shadow run shows divergence that takes more than a day to
  diagnose.** Something fundamental is misunderstood. Stop, study,
  resume only when the divergence is explained.
- **The pipeline starts failing in production for unrelated reasons
  during a phase.** Pause Phase 2 work, fix production first, resume
  the cadence next week.
- **Hostile external attention arrives mid-decomposition** (a
  high-traffic link, press coverage, etc). Pause Phase 2. The
  methodology page from Phase 1 is honest; that is the version that
  faces scrutiny. Resume after the attention cycle.

---

## Drift Protection

The HYBRID plan's biggest risk is drift. Six weeks is long. Real life
intervenes. The protections:

### Public commitment

`/status.html` shows decomposition progress to every visitor. *"3 of 6
modules extracted. Last extraction: 2026-05-31."* Drift becomes
publicly visible. The audit trail is the forcing function — same role
CHANGES.md plays for the manuscript.

### Calendar block

A standing two-hour block, same day every week (recommended: Monday
morning). Set it as a recurring calendar event. Defended like a
doctor's appointment. The week's work happens in that block.

### Slack the plan, don't slip the standard

If a week is impossible, slip the calendar week. Do not slip the
acceptance standard. A half-extracted module merged because "I'm
behind schedule" is worse than a one-week slip — it puts a buggy
module in production and rewards drift.

### Public roadmap on /status.html

After the orchestrator week, the decomposition is "complete" but the
page should still show the audit cadence: *"Methodology page audited
quarterly. Last audit: [date]. Next scheduled: [date]."* That keeps the
honest-page work as a recurring practice, not a one-time event.

### A single trusted reader

Find one person — engineer, journalist, or peer — who you trust to
push back. Show them `/status.html` and `about.html` once a month. If
they spot a drift between page and code, that's the early warning.

---

## Definitions of Done

### Phase 0 done when:
- All three commits merged to main and pushed
- Live site cannot produce fictional content under any normal user path
- Blindspots page shows real, derived blindspots from the live cycle
- About.html displays the audit-in-progress banner

### Phase 1 done when:
- About.html rewritten, every claim has a code reference
- Source counts reconciled to one canonical phrasing
- Original about.html preserved in `audit/`
- `/status.html` is public, reads real data, shows 0/6 decomposition
- One full pipeline cycle observed on the new status page
- Banner on about.html points to live `/status.html`

### Each Phase 2 week N done when:
- Module exists with schemas, validation, structured logging
- Fixture-equivalence test passes and runs in CI
- Monolith delegates to the new module
- One full shadow cycle showed equivalent output
- `pipeline_state.json` updated
- `about.html` updated
- `/status.html` shows N/6 modules extracted

### Phase 2 (overall) done when:
- All six analytical modules exist as discrete files in `pai_modules/`
- Orchestrator (`run_pipeline.py`) runs the seven stages end-to-end
- `pipeline_run.json` produced per cycle, schema-valid
- `/status.html` reads from `pipeline_run.json` for per-stage health
- `generate_feed.py` renamed to `.legacy.py` and unused except as
  rollback
- `about.html` describes the actual architecture, no roadmap caveats
- Two clean shadow cycles before final merge
- `bomba_pipeline.sh` invokes the orchestrator, not the monolith

### The whole plan done when:
- `/about.html` makes claims that all map to code via file:line
- `/status.html` shows live, accurate, per-stage pipeline health
- A hostile reader auditing the site finds no claim they cannot verify
- The site can survive its own promise: **BE UNDENIABLE**

---

## Appendix A — Per-Week Module Briefs

### Week 1 — `event_clusterer.py`

**Reads:** `news_cache.jsonl` (output of `global_ingestor.py`)
**Writes:** `clusters.jsonl`
**What it does:** Groups articles about the same event using entity
overlap and semantic proximity. One cluster = one story, many framings.
**Where in monolith:** Search `generate_feed.py` for cluster-building
logic — likely a section creating dicts keyed by topic or event ID with
article lists as values.
**Likely entanglement:** Low. Clustering is usually a self-contained
pass. The output is the input to bias scoring, so the contract is
clean.
**Schema considerations:**
- Input: array of article objects with `id`, `source`, `headline`,
  `body`, `entities`, `published_at`
- Output: array of cluster objects with `cluster_id`, `member_ids`,
  `entity_overlap_score`, `representative_headline`

---

### Week 2 — `bias_scorer.py`

**Reads:** `clusters.jsonl`
**Writes:** `scored.jsonl`
**What it does:** Scores each article on the five-axis system
(atlanticist, interventionist, zionist, statist, financialized) using
propaganda lexicon matching, agency-verb analysis, and source
fingerprint weighting.
**Where in monolith:** Look for the section that loads source
fingerprints and applies per-article scoring. Likely uses the source
registry and a lexicon file.
**Likely entanglement:** Medium. Bias scoring depends on the source
registry and lexicon files. Make sure those are passed as inputs (not
read globally) so the module is testable.
**Schema considerations:**
- Input: clusters with member articles
- Output: clusters with each article augmented by a `bias_scores`
  object: `{atlanticist: float, interventionist: float, zionist: float,
  statist: float, financialized: float}`, all in [-1.0, 1.0]
- Source registry path passed as a parameter

---

### Week 3 — `framing_differ.py`

**Reads:** `scored.jsonl`
**Writes:** `framings.jsonl`
**What it does:** Within each cluster, compares headlines, ledes, verb
choices, and named entities across sources. Produces the framing
comparison table shown on each story page.
**Where in monolith:** Look for headline/lede comparison logic, likely
producing a per-cluster dict of framing differences keyed by source
bloc.
**Likely entanglement:** Low to medium. Framing diff is a pass over
already-scored data; the comparison logic is self-contained but may
share string-processing utilities with bias scorer.
**Schema considerations:**
- Input: scored clusters
- Output: clusters augmented with a `framings` object: per-bloc
  headline/lede/verb summaries, framing variance scores

---

### Week 4 — `blindspot_analyzer.py`

**Reads:** `framings.jsonl`
**Writes:** `blindspots.jsonl`
**What it does:** Cross-references Western vs adversarial vs
non-aligned coverage volume per cluster. Stories covered by one bloc
and ignored by another are surfaced as blindspots with a score.
**Where in monolith:** Look for volume-comparison logic across source
blocs. May be inline with the framing diff.
**Likely entanglement:** Low. Pure analytical pass.
**Parallel-safe with:** Week 5 (coverage_mapper).
**Schema considerations:**
- Input: framings
- Output: array of blindspot objects: `{story_id, type
  (western_only/adversarial_only/non_aligned_only), volume_delta,
  blocs_covering, blocs_silent, score}`

---

### Week 5 — `coverage_mapper.py`

**Reads:** `framings.jsonl`
**Writes:** `coverage.jsonl`
**What it does:** Generates the heatmap distribution
(Western/Neutral/Adversarial) per story and the bias variance score.
High variance = blocs disagree sharply on this story.
**Where in monolith:** Look for the bias-variance computation and
heatmap data structure.
**Likely entanglement:** Low. Pure analytical pass.
**Parallel-safe with:** Week 4 (blindspot_analyzer).
**Schema considerations:**
- Input: framings
- Output: array of coverage objects per story: `{story_id,
  western_count, neutral_count, adversarial_count, bias_variance,
  heatmap_distribution}`

---

### Week 6 — `broadcast.py`

**Reads:** `framings.jsonl`, `blindspots.jsonl`, `coverage.jsonl`
**Writes:** `api/latest.json`, `api/blindspots.json`
**What it does:** Serializes pipeline output to the public API files
the website reads.
**Where in monolith:** The final section of `generate_feed.py` —
JSON serialization and file writes.
**Likely entanglement:** Low. Mechanical serialization pass once the
upstream stages are modular. This is the easiest week.
**Schema considerations:**
- Inputs: three jsonl files
- Outputs: two JSON files conforming to existing front-end consumer
  contracts. **The output schema is fixed by what the front-end
  expects** — this is the only week where the output schema cannot
  change.

---

### Week 7 — Orchestrator

**Replaces:** `generate_feed.py`
**Creates:** `run_pipeline.py`, `pipeline_run.json` schema
**See main Phase 2 Week 7 section above.**

---

## Appendix B — Paste-Ready Prompts

### Phase 1 Step 1 — About.html audit prompt

```
You are auditing botwavebomba/about.html against the live pipeline
code. This is a read-only investigation. Do not modify about.html.

TASK 1 — Inventory claims

Read about.html top to bottom. Extract every factual claim into a
numbered list. A "claim" is any statement that asserts something is
true about the system: architecture, source counts, schedule,
methodology, etc. Marketing language ("BE UNDENIABLE") is not a claim.
Architecture descriptions ("seven-stage pipeline") are claims.

TASK 2 — Verify each claim

For each claim, search the codebase for evidence:
- bomba_pipeline.sh
- generate_feed.py
- global_ingestor.py
- book_arm/pai_modules/* (note: these may exist as files but be unused)
- Any source registry files
- systemd unit files

Mark each claim as one of:
- TRUE — code does exactly what the claim says
- PARTIAL — code does something similar but not exactly as described
- FALSE — code does not do this, or does it differently
- UNVERIFIABLE — cannot determine from available code

For each verdict, provide file:line evidence. If UNVERIFIABLE, say what
would be needed to verify.

TASK 3 — Reconcile source counts

The page references "244 sources" in multiple places. Find:
- The actual source registry file
- The number of sources currently ingested (run wc -l or similar)
- The number with full bias fingerprints
- The number referenced in any unit description or comments

Report all numbers found and propose a single canonical phrasing.

TASK 4 — Output

Write botwavebomba/audit/about_audit_2026-05-10.md with:
- Header: date, files audited, agent session
- One section per claim, with verdict and evidence
- "Source count reconciliation" section
- "Summary" section: count of TRUE/PARTIAL/FALSE/UNVERIFIABLE

Do NOT modify about.html. Do NOT propose rewrites. This is the
discovery pass only. The rewrite plan is a separate task.

When done, print the summary counts and stop.
```

### Phase 1 Step 4 — /status.html v1 build prompt

```
You are building botwavebomba/status.html v1, a public pipeline health
page. This is a build task. Make commits.

REQUIREMENTS

The page must show, all read at runtime from real files:

1. Last successful pipeline run
   - Source: mtime of api/latest.json (use HEAD or HEAD-style fetch)
   - Display: ISO timestamp + relative time ("3 hours ago")
   - Color: green if < 8 hours, yellow if 8-24 hours, red if > 24 hours

2. Article count and story count
   - Source: count entries in api/latest.json
   - Display: large numerals with labels

3. Source counts (three numbers)
   - Total ingested: count from source registry
   - Currently fingerprinted: count of sources with non-null bias scores
   - Awaiting fingerprinting: difference of the above
   - Display: table with all three numbers and one-line definitions

4. Decomposition progress
   - Source: botwavebomba/pipeline_state.json (create with initial state
     showing 0/6 modules extracted)
   - Display: list of 6 modules with status badges
     (monolith / extracted / in_progress) and a progress bar

5. Last methodology audit date
   - Source: pipeline_state.json field "last_audit"
   - Display: footer line

CONSTRAINTS

- No hardcoded values. Every number comes from a file at runtime.
- Auto-refresh every 60 seconds via JavaScript (no full page reload)
- Match botwavebomba's existing visual style (dark theme, mono font,
  match index.html's design language)
- Failure states are visually distinct: yellow banner for degraded
  (some data stale), red banner for failed (data fetch failed)
- If pipeline_state.json is missing, show a clear error, not silent
  zero counts

DELIVERABLES

- botwavebomba/status.html
- botwavebomba/js/status.js (or inline in status.html if simpler)
- botwavebomba/pipeline_state.json (initial state)
- Link added in botwavebomba/index.html footer
- Update botwavebomba/about.html banner to point to /status.html

ACCEPTANCE TEST

Test these scenarios manually before declaring done:
1. Normal: load page, all numbers populate, pipeline shows green
2. Stale: artificially set api/latest.json mtime to 12 hours ago,
   confirm yellow banner
3. Failed: artificially break the api/latest.json fetch (rename the
   file), confirm red banner with clear error message, no zeros
   silently displayed
4. Auto-refresh: load page, wait 60 seconds, confirm a network request
   fires for fresh data without page reload

Commit in small steps with descriptive messages.

When done, write LANE_STATUS_DONE.md with screenshots described and
the failure-mode test results.
```

### Phase 2 weekly extraction prompt template

```
You are extracting <MODULE_NAME> from generate_feed.py into a discrete
module. This is week <N> of the BOTWAVEBOMBA decomposition plan.

CONTEXT

Read BOTWAVEBOMBA_HYBRID_GAMEPLAN.md, especially Appendix A entry for
this module. The plan's per-week pattern is mandatory; do not deviate.

CONSTRAINTS

1. This is a refactor, not a rewrite. Copy the analytical logic from
   generate_feed.py verbatim. Do not improve it. The fixture-
   equivalence test is the spec.
2. Schema validation on entry and exit. Fail loud.
3. Structured logging at start and end.
4. Do not delete or modify generate_feed.py except to insert the
   delegation call to the new module.
5. The monolith stays running until Week 7's orchestrator replaces it.

DELIVERABLES

1. botwavebomba/pai_modules/<module>.py with run() function
2. botwavebomba/schemas/<module>_input.schema.json
3. botwavebomba/schemas/<module>_output.schema.json
4. botwavebomba/fixtures/<module>_input.jsonl (real fixture from a
   recent pipeline run)
5. botwavebomba/fixtures/<module>_expected_output.jsonl (output of the
   monolith on the input fixture)
6. tests/test_<module>.py — fixture-equivalence test
7. generate_feed.py modified to delegate to the new module
8. pipeline_state.json updated (modules_extracted incremented, this
   stage marked "extracted")
9. about.html updated (this stage flipped from "monolith" to "discrete
   module" with file reference, audit date updated)

ACCEPTANCE GATE

Do not declare done until ALL of these are true:
- [ ] New module exists and is importable
- [ ] Schemas exist and validate sample inputs/outputs
- [ ] Fixture-equivalence test passes
- [ ] Test runs in CI
- [ ] generate_feed.py delegates to new module
- [ ] One full local pipeline run shows api/*.json equivalent to
      previous run on same input
- [ ] pipeline_state.json updated
- [ ] about.html updated

The shadow run (24 hours of staging vs production comparison) happens
after merge. Do not skip it. Do not declare the week done until the
shadow run completes.

When done with the local work, write LANE_WEEK_<N>_DONE.md
summarizing:
- What you extracted, with line ranges from the original monolith
- Any helpers that needed to come along
- Any logic in the monolith that was ambiguous or apparently dead
  code (note for future cleanup, do not act on it)
- Fixture-equivalence test results
- Open questions for the shadow run
```

---

## Appendix C — Reference Schemas

See live files:
- `botwavebomba/pipeline_state.json` — initial state shipped Phase 1
- `botwavebomba/schemas/pipeline_run.schema.json` — Week 7 contract drafted ahead

---

## Final Note

This plan is built around a single principle: **the methodology page and
the code converge into truth, in public, on a visible cadence**. Every
weekly Friday merge ships a small, verifiable improvement. Every visitor
to `/status.html` sees the work happening. The plan succeeds not by
shipping fast but by shipping *honestly* every week for seven weeks.

That is what BE UNDENIABLE actually requires.
