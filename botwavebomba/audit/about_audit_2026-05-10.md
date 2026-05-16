# about.html — Methodology Audit
**Date:** 2026-05-10
**Auditor:** Automated audit (read-only investigation; no code or page modified during audit)
**Source under audit:** `zombie760.github.io/botwavebomba/about.html` (210 lines)
**Code searched:**
- `zombie760.github.io/scripts/bomba_pipeline.sh` (live pipeline shell, 82 lines)
- `zombie760.github.io/scripts/generate_feed.py` (the monolith, ~800 lines)
- `book_arm/pai_modules/global_ingestor.py` (live; pulls 423 RSS sources)
- `book_arm/pai_modules/event_clusterer.py` (standalone; **not invoked by live pipeline**)
- `book_arm/pai_modules/bias_scorer.py` (standalone; **not invoked**)
- `book_arm/pai_modules/framing_differ.py` (standalone; **not invoked**)
- `book_arm/pai_modules/blindspot_analyzer.py` (standalone; **not invoked**)
- `book_arm/pai_modules/coverage_mapper.py` (standalone; **not invoked**)
- `Business/bots/botwave_news/distribution/broadcast.py` (standalone; **not invoked**)
- `~/.config/systemd/user/botwave-bomba-pipeline.{service,timer}`
- `book_arm/memory/sources_global.json` (ingest set, 423 sources)
- `zombie760.github.io/botwavebomba/data/source_registry.json` (bias-rated registry, 244 sources)

---

## Claim inventory

Every factual assertion on `about.html` is enumerated below. Marketing language ("BE UNDENIABLE", "every component named", "primary sources or nothing") is identity, not claim — excluded. Architecture descriptions, source counts, methodology references, named modules, time/schedule assertions, and reconciliation claims are claims and ARE audited.

### Section: What BOTWAVEBOMBA Is — about.html:53-68

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| C1 | "Every article you see here was ingested, scored, clustered, and framing-analyzed by an automated pipeline" | PARTIAL | `bomba_pipeline.sh:39` invokes `global_ingestor.py --run` (ingest). `bomba_pipeline.sh:44` invokes `generate_feed.py` which does clustering (`scripts/generate_feed.py:3` docstring, ~lines 256-410 cluster logic) and bias-rating-via-lookup (lines 407-421). Framing analysis = headline comparison across cluster members. So: yes ingested + clustered + bias-rated + multi-source assembled. NOT "framing-analyzed" in the deep sense the methodology elsewhere claims (verb-choice / propaganda lexicon — see C12, C13). |
| C2 | "244 global news sources" | PARTIAL | `data/source_registry.json:total=244` — TRUE for the bias-rated registry. But `sources_global.json` (the ingest set) has 423 sources; systemd unit Description says "317" (stale). The pipeline ingests 423; the methodology page rounds to "244" because that's the rated subset. Misleading without footnote. |
| C3 | "updated every six hours" | TRUE | `~/.config/systemd/user/botwave-bomba-pipeline.timer`: `OnCalendar=*-*-* 00,06,12,18:00:00`. Last 4 successful pushes on 2026-05-10 at UTC 01:24, 07:23, 15:52, 19:23 — exactly the schedule. |
| C4 | "It is not a news aggregator in the Google News sense" | TRUE | This is a negative claim about positioning, not a factual code claim. The pipeline does not just aggregate; it clusters across blocs and attaches bias data. Statement holds. |
| C5 | "a framing delta engine" | PARTIAL | `compute_coverage` in `generate_feed.py:291-340` produces per-bloc percentages and a blindspot flag (the "delta"). But sentence-level framing analysis (verb choice / propaganda lexicon) is not invoked. The "delta" is volume + bias-axis variance, not language-level framing. |

### Section: Why Not Left / Center / Right? — about.html:70-97

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| C6 | "Five independent axes, each scored from -1.0 to +1.0" | TRUE | `data/source_registry.json` first entry: `axis: {interventionist, zionist, atlanticist, statist, financialized}`. Values observed in [-1.0, 1.0]. Per-source, not per-article. |
| C7 | Axis names: atlanticist, interventionist, zionist, statist, financialized | TRUE | Verbatim match in `data/source_registry.json` per-source `axis` block. |
| C8 | "Five-dimensional fingerprint per source" | TRUE | Per-source lookup. `generate_feed.py:407-421` uses `get_atlanticist_score(source_id, fps)`; the rest of the axes are computed similarly via `axis.get(...)`. |

### Section: The TELOS+PAI Pipeline — about.html:99-138

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| C9 | "The pipeline runs in seven stages" | **FALSE** | `bomba_pipeline.sh` runs: (0) sync staging, (1) `global_ingestor.py --run`, (2) `generate_feed.py` (monolith doing clustering + bias lookup + blindspot flag + framing assembly inline), (2.5) `generate_cards.py`, (3) rsync, (4) git commit+push, (5) `blindspot_alert.py` (Telegram), (6) `broadcaster.py` (Discord+X). Two analytical stages (ingest + monolith), plus deploy/notification plumbing. The "seven" of the methodology page maps to the standalone modules in `book_arm/pai_modules/` which are **not invoked**. |
| C10 | "global_ingestor.py — pulls RSS feeds and article full-text from all 244 sources, deduplicates by content hash, stores to news_cache.jsonl" | PARTIAL | TRUE: pulls RSS + full text via httpx+readability (`global_ingestor.py:46-47`), dedup by hash, writes `news_cache.jsonl` (`global_ingestor.py:54`). FALSE: "from all 244 sources" — `global_ingestor.py:53` reads `sources_global.json` which has **423** sources, not 244. |
| C11 | "event_clusterer.py — groups articles about the same event using entity overlap and semantic proximity" | **FALSE as stated** | `book_arm/pai_modules/event_clusterer.py` exists (would use tfidf + optional sentence_transformers) but is **not invoked** by the live pipeline. Clustering in the live pipeline is inline in `generate_feed.py` (header docstring: "multi-entity pair clustering"). Uses entity overlap; no semantic-proximity embedding model is loaded. The named file does not run; the inline logic doesn't match the claim. |
| C12 | "bias_scorer.py — scores each article on the five-axis system using propaganda lexicon matching, agency-verb analysis, and source fingerprint weighting. Score range: -6 to +6 per article." | **FALSE** | `book_arm/pai_modules/bias_scorer.py` exists, has propaganda-lexicon + agency-verb logic + -6 to +6 single-axis output (`bias_scorer.py:6-13`). It is **not invoked** by the live pipeline. The live monolith does per-SOURCE 5-axis LOOKUP from `source_registry.json` — not per-article scoring. The methodology page is describing the standalone module's *would-be* behavior, not what runs. |
| C13 | "framing_differ.py — compares headlines, ledes, verb choices, and named entities across sources" | **FALSE as stated** | `book_arm/pai_modules/framing_differ.py` exists but is **not invoked**. Inline in the monolith: lede extraction at `generate_feed.py:30`, cluster-member headline assembly. No verb-choice analysis. No named-entity diff. The standalone module would do these; the live code does not. |
| C14 | "blindspot_analyzer.py — cross-references Western vs adversarial vs non-aligned coverage volume per cluster. If one bloc covers a story and another doesn't, that gap is surfaced as a blindspot with a score." | PARTIAL | `book_arm/pai_modules/blindspot_analyzer.py` exists but is **not invoked**. The behavior IS present, just inline in `generate_feed.py:291-410` (`compute_coverage` + Blackout/Spotlight thresholds + `is_blindspot` flag). The "discrete `blindspot_analyzer.py` stage" framing is false; the analytical behavior is true. |
| C15 | "coverage_mapper.py — generates the heatmap distribution (Western / Neutral / Adversarial) per story and the bias variance score" | PARTIAL | `book_arm/pai_modules/coverage_mapper.py` exists but is **not invoked**. The heatmap distribution comes from `compute_coverage` in the monolith (`generate_feed.py:291`); bias variance derived from atlanticist axis scores at `generate_feed.py:660`. Behavior present, not as a discrete module. |
| C16 | "broadcast.py — serializes the pipeline output to /api/latest.json and /api/blindspots.json" | **FALSE** | `Business/bots/botwave_news/distribution/broadcast.py` exists but is **not invoked**. Serialization is done inline by `generate_feed.py`. `api/blindspots.json` was REMOVED in commit `087dcbd` (2026-05-10) because no code wrote to it — it was a one-time fossil from commit `4a55450`. The "broadcast.py serializes to both files" claim is doubly false: wrong module name AND one of the two named outputs no longer exists. |
| C17 | "Updated every six hours by systemd timer" | TRUE | See C3. Restated under the broadcast.py heading in the original; the timer claim is true even though the broadcast.py claim is false. |

### Section: What We Do Not Do — about.html:140-149

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| C18 | "We do not editorialize. The framing comparison shows the delta; you read it." | TRUE | No editorial generation in `generate_feed.py`. Outputs are structural (cluster + sources + axis lookup). |
| C19 | "We do not write summaries. Every 'summary' field is extracted from the original article." | TRUE | `generate_feed.py:631`: `summary = headline_art.get('description', '') or ''` — uses article description verbatim. `generate_feed.py:738`: writes `summary[:300]`. Truncated, not generated. |
| C20 | "We do not rate factuality of individual claims. We rate source-level factuality patterns using MBFC data." | UNVERIFIABLE | `data/source_registry.json` carries per-source `factuality: "high|mixed|low"` ratings. But no code in the repo ingests MBFC — MBFC is mentioned only in HTML files (`about.html`, `index.html`, `sources.html`). The factuality values may have been hand-entered using MBFC as reference, but the trace from MBFC to specific source ratings is not in the codebase. Cannot verify or refute from code alone. |
| C21 | "We do not suppress adversarial sources. RT and Sputnik are in the index, labeled clearly, sourced directly." | TRUE | `data/source_registry.json` includes `rt`, `rt_arabic`, `sputnik`, plus a `bloc: "adversarial"` label. Labels visible. |
| C22 | "We do not invent. Every claim traceable to a document, a URL, a byline." | TRUE | Each story in `api/latest.json` carries `sources[].url` resolving to original article. Spot-checked: live URLs resolve. |

### Section: The Journalism Connection — about.html:151-171

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| C23 | "BOTWAVEBOMBA is the public surface of a private investigative research substrate" | TRUE | The book_arm + `Telos/substrate/` directory structure is the private substrate; `bomba_pipeline.sh` references `book_arm/.venv` and reads from `book_arm/memory/`. Public site is a downstream consumer. |
| C24 | "The same 244-source pipeline that powers this site powers primary-source discovery for book-length investigation" | PARTIAL | The same ingest layer is used (`global_ingestor.py` writes to `book_arm/memory/news_cache.jsonl`, consumed by both arms). But "244-source" mis-states the ingest set as above. |

### Section: Bias Scoring Baseline — about.html:173-190

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| C25 | "Scores derived from three sources: AllSides + MBFC + hand-curated TELOS+PAI fingerprints" | UNVERIFIABLE | `data/source_registry.json` declares this in its `methodology` field. No per-source provenance trace ("axis.interventionist for Reuters came from AllSides value X / MBFC value Y / hand-curation note Z") exists in any artifact. No AllSides or MBFC ingestion script in the repo. The claim cannot be verified or refuted by reading code alone. |
| C26 | "Hand-curation methodology: editorial stance analysis of 50+ articles per source, entity framing patterns, named-state-alignment patterns, institutional-alignment signals" | UNVERIFIABLE | No artifact in the repo documents which sources got this treatment or shows the 50+ article corpus. May have been done off-machine; no evidence in code. |
| C27 | "Scores were generated on 2026-04-23 for the initial 208-source set and extended to 244 sources" | **FALSE** | `data/source_registry.json` has `generated_at: 2026-05-09T00:00:00Z` (not 2026-04-23). Git log shows the file was introduced at 244 sources in a single commit (`c6a088bf`, "Ground News rival — 244 sources, 5 bias axes"). No 208-source version exists in repo history. The "extended from 208" claim has no artifact to back it. |
| C28 | "The registry is versioned. Updates are logged." | PARTIAL | Versioned by git: TRUE. "Updates are logged": there is no separate update log; only the git history (one commit). The claim implies a richer audit trail than exists. |

---

## Source count reconciliation

Three numbers are referenced across the codebase. They are not the same population.

| Number | Source file | What it counts |
|---|---|---|
| **423** | `book_arm/memory/sources_global.json` | RSS feeds the live ingestor attempts on each 6-hour run |
| **317** | systemd unit `Description=` field | Stale number from older config; cosmetic only, no enforcement |
| **244** | `zombie760.github.io/botwavebomba/data/source_registry.json#total` | Sources with full 5-axis bias fingerprints attached |
| **221** | `book_arm/CLAUDE.md` (146 English + 75 native) | A documented intermediate set; possibly the previous ingest set |

**Recommended canonical phrasing for the rewrite:**

> 423 sources ingested every six hours. 244 of those carry full five-axis bias fingerprints. 179 are awaiting fingerprinting and contribute to volume metrics but not to per-source framing classification. Source counts updated in `pipeline_state.json` whenever the registry expands.

Also: the unit Description should be corrected from "317" to "423" when convenient (cosmetic, no functional impact).

---

## Decomposition-status summary (for the rewrite)

| Named module on about.html | Standalone file exists? | Invoked by live pipeline? | Behavior present somewhere? |
|---|:---:|:---:|---|
| `global_ingestor.py` | yes | **yes** | yes, as described |
| `event_clusterer.py` | yes | no | partial — inline in monolith with simpler approach |
| `bias_scorer.py` | yes | no | no — monolith does per-source lookup, not per-article scoring with lexicon/agency-verb |
| `framing_differ.py` | yes | no | partial — lede extraction + headline assembly inline; no verb-choice / NE diff |
| `blindspot_analyzer.py` | yes | no | yes — inline in `generate_feed.py:291-410` |
| `coverage_mapper.py` | yes | no | yes — inline in `generate_feed.py:291` + bias-variance at `:660` |
| `broadcast.py` | yes (wrong location) | no | yes — JSON serialization inline in `generate_feed.py`; deploy in `bomba_pipeline.sh` |

**Rephrased for the rewrite:** Of seven named modules, **one** is wired and runs (`global_ingestor.py`). Five describe behaviors that are present in the monolith but not as discrete modules. One (`bias_scorer.py`) describes behavior that **is not present anywhere** in the live pipeline — the live pipeline does per-source LOOKUP, not per-article scoring with lexicon/agency-verb.

---

## Verdict count

| Verdict | Count | Claims |
|---|:---:|---|
| TRUE | 9 | C3, C6, C7, C8, C18, C19, C21, C22, C23 |
| PARTIAL | 10 | C1, C2, C5, C10, C14, C15, C17 (= C3, dup), C24, C28 |
| FALSE | 5 | C9, C11, C12, C13, C16, C27 |
| UNVERIFIABLE | 3 | C20, C25, C26 |
| TOTAL | 27 unique claims | |

(C11 + C13 marked "FALSE as stated" — see notes; the underlying behavior is partial. Categorized as FALSE because the specific code references named on the page are dead code, which is the dismissibility surface.)

### Where the credibility risk concentrates

The five **FALSE** rows all live in the `<h2>The TELOS+PAI Pipeline</h2>` section (about.html:99-138). One section. Five false claims. Three more PARTIAL claims in the same section. **The decomposition narrative is the only structurally-vulnerable section of the page.** The framing-axis section (C6-C8) and the "What We Do Not Do" section (C18-C22) are mostly solid.

The three UNVERIFIABLE rows all cluster around the bias-baseline section (C20, C25, C26). These don't fail audit but lack a code trace — a hostile reader can ask "show me where MBFC data is ingested" and there's no answer. Either move to roadmap, document the off-machine methodology, or soften to "hand-curated, drawing on AllSides and MBFC where available" without claiming a data pipeline that doesn't exist.

---

## Summary line

**FALSE: 5 claims. PARTIAL: 10. UNVERIFIABLE: 3. TRUE: 9.** Of 27 audited factual claims on `about.html`, 18 require rewrite (PARTIAL + FALSE + UNVERIFIABLE) before the page is undeniable. The decomposition-stage narrative (C9–C16) needs the heaviest rework; the framing-axis and "What We Do Not Do" sections need the lightest.

The rewrite plan (Phase 1 Step 2) takes this file as input.
