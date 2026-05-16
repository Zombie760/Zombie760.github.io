# Botwavebomba Pipeline Diagnostic
Date: 2026-05-10
Investigator: Automated audit (read-only, no scripts run)

## Verdict
**STALE_BUT_HEALTHY**

`latest.json` regenerates and pushes every 6 hours as advertised. `blindspots.json` is a one-time fossil from the seed commit. The pipeline runs the work it actually does, on time, end-to-end — but the work it actually does is a small subset of what `about.html` claims. The site is not broken. The story about the site is.

---

## Pipeline reality

The live pipeline is `zombie760.github.io/scripts/bomba_pipeline.sh`. It calls one analytical module and one monolith. The other "stages" exist as standalone files in `book_arm/pai_modules/` but are not invoked.

| Stage | Script | Exists | Input present | Output present | Last run | Status |
|---|---|---|---|---|---|---|
| broadcast | `Business/bots/botwave_news/distribution/broadcast.py` | Yes (file exists) | n/a — **not in pipeline path** | n/a | never (from bomba pipeline) | **DEAD CODE** — referenced by `about.html` but `bomba_pipeline.sh` never calls it. Discord/Telegram alerts come from `scripts/blindspot_alert.py` + `broadcaster.py`. |
| coverage_mapper | `book_arm/pai_modules/coverage_mapper.py` | Yes | `news_cache.jsonl` (fresh) | none — script is CLI-only, never wired | never (from bomba pipeline) | **DEAD CODE** in pipeline. |
| blindspot_analyzer | `book_arm/pai_modules/blindspot_analyzer.py` | Yes | `claims_english.jsonl` / `claims_translated.jsonl` — **NOT FOUND** at expected paths | would write `blindspots_analysis.json` (last touched Apr 24 13:19, fossil) | never (from bomba pipeline) | **DEAD CODE** in pipeline. The served `api/blindspots.json` is **not** written by this module — no script in the repo writes to that exact path. |
| framing_differ | `book_arm/pai_modules/framing_differ.py` | Yes | `clusters.jsonl` (Apr 23 19:29 — 17d stale), `news_cache.jsonl`, `propaganda_lexicon.json` | `output/research/framing/*.md/.json` | never (from bomba pipeline) | **DEAD CODE** in pipeline. |
| bias_scorer | `book_arm/pai_modules/bias_scorer.py` | Yes | claims jsonl + `source_fingerprints.json` | claims_scored.jsonl | never (from bomba pipeline) | **DEAD CODE** in pipeline. Also: scores on **one axis** (-6 to +6 interventionism), not the five axes the methodology page advertises. |
| event_clusterer | `book_arm/pai_modules/event_clusterer.py` | Yes | `news_cache.jsonl` | `clusters.jsonl` (Apr 23 19:29 — 17d stale, confirms last manual run) | never (from bomba pipeline) | **DEAD CODE** in pipeline. |
| global_ingestor | `book_arm/pai_modules/global_ingestor.py` | Yes | `sources_global.json` (423 sources) | `news_cache.jsonl` (11825 lines, May 10 12:23, 53 MB) | 2026-05-10 12:03–12:23 PDT | **LIVE** — pulls all sources, dedup by hash, writes `_ingest_errors.jsonl` for failed feeds. Fails loud (status=124 timeout, status=128 git push failures). |
| **generate_feed.py (the actual pipeline)** | `zombie760.github.io/scripts/generate_feed.py` | Yes | `news_cache.jsonl` + `source_registry.json` + `source_fingerprints.json` | `botwavebomba/api/latest.json` | 2026-05-10 12:23 PDT | **LIVE** — monolith. Inline clustering, 5-axis lookup from source registry, blindspot flagging via `is_blindspot` per story, framing comparison. This is the entire analytical pipeline as it currently exists. |

**The pipeline is not seven stages. It is two: `global_ingestor.py` (ingest) → `generate_feed.py` (monolith that does clustering, scoring, framing, and blindspot flagging inline). Plus deploy plumbing (rsync, git push, alerts).**

`blindspots.json` has **no writer in the codebase**. The closest matches (`_blindspots.json` at `book_arm/memory/`, `blindspots_analysis.json` at `book_arm/memory/`) are different paths, last touched Apr 24, and aren't served. The served `botwavebomba/api/blindspots.json` was committed exactly once (commit `4a55450` — "Ground News rival seed") and never rewritten.

---

## Schedule reality

Mechanism: **`botwave-bomba-pipeline.timer`** at `~/.config/systemd/user/botwave-bomba-pipeline.timer`.

```
OnCalendar=*-*-* 00,06,12,18:00:00
RandomizedDelaySec=300
Persistent=true
```

Fires the matching `.service` which runs `/var/home/gringo/Botwave-Master/zombie760.github.io/scripts/bomba_pipeline.sh`. 30-minute timeout.

**Actual recent run history (`journalctl -u botwave-bomba-pipeline.service --since "7 days ago"`):**

| Started | Outcome | Notes |
|---|---|---|
| May 09 08:53:10 | FAILED status=1 | `mkdir: cannot create directory '/var/log/botwave'` (perms) |
| May 09 11:51:22 → 12:34:20 | FAILED status=128 | git push failure |
| May 09 17:10:48 → 17:31:31 | FAILED status=128 | git push failure |
| May 09 18:00:25 → 18:24:01 | FAILED status=128 | git push failure |
| May 10 00:02:55 → 00:23:55 | **SUCCESS** | commit `02f8a88` pushed |
| May 10 04:45:06 | FAILED status=128 | git push failure |
| May 10 06:01:43 → 06:26:45 | FAILED status=124 | timeout (ingest exceeded 25 min) |
| May 10 08:28:13 → 08:52:56 | **SUCCESS** | commit `da6c2b0` pushed |
| May 10 12:03:44 → 12:23:44 | **SUCCESS** | commit `2e7ea2a` pushed |
| (after diagnostic started) | — | next firing 18:01:45 |

Last actual fresh push of `latest.json` to the live site: **2026-05-10T19:23:31Z** (`generated_at` in served JSON). ~3 hours stale at diagnostic time, which is within the 6-hour window. **Schedule mechanism exists and works.** Recent failure rate is high enough (~50% on intermediate firings) that operator should consider this — but every 6h window still catches at least one success, so observed staleness is bounded.

`.github/workflows/` — does not exist. No GitHub Actions cron behind the scenes. The systemd timer is the only mechanism.

---

## Front-end reality

`zombie760.github.io/botwavebomba/assets/js/api.js` defines `BWB_API` with `base: '/botwavebomba/api'`. Three fetches:

| Caller | URL string | Resolves to (live) | Failure mode |
|---|---|---|---|
| `getLatest()` | `${this.base}/latest.json` → `/botwavebomba/api/latest.json` | `https://zombie760.github.io/botwavebomba/api/latest.json` ✓ | **Silent fallback to `_demoPayload()`** — hardcoded fictional stories (Reuters/AP/IRNA/RT/SCMP demo). `console.warn` only. Reader has no visible signal data is fake. |
| `getBlindspotsData()` | `${this.base}/blindspots.json` | `https://zombie760.github.io/botwavebomba/api/blindspots.json` ✓ | Returns `{stories: []}`. Then `blindspot.js:11-18` derives blindspots from `latest.json` via `is_blindspot` / `blindspot_score > 4` filter — **good fallback design that never fires** because the stale `blindspots.json` returns 200 with non-empty data. |
| `getSources()` | `${this.dataBase}/source_registry.json` → `/botwavebomba/data/source_registry.json` | `https://zombie760.github.io/botwavebomba/data/source_registry.json` ✓ | No try/catch. Bare promise rejection on failure. |

**No subpath bug.** `/botwavebomba/...` from page served at `zombie760.github.io/botwavebomba/` resolves correctly because GitHub user-Pages domain `zombie760.github.io` serves the repo at root, and `botwavebomba` is a subdirectory of that root.

**`api/` is not in `.gitignore`.** API files are tracked. Pages serves them.

The em-dashes (`#story-count`, `#blindspot-count`, `#bs-total-count`) are **placeholders in the HTML before JS runs**. On a successful fetch they are replaced. On a silent demo fallback they get replaced with **demo numbers indistinguishable from real ones**. The em-dashes the operator sees in the wild are either (a) the brief pre-JS window or (b) a renderer JS path on a page where the fill code is missing — investigation of which specific `id` is stuck would tell the difference but is outside the read-only scope here.

---

## Methodology claims audit

| Claim on `about.html` | Verdict | Evidence |
|---|---|---|
| "244 global sources" | **PARTIALLY_TRUE** | `source_registry.json` has 244 entries (the bias-rated set). But `sources_global.json` (the ingest set) has **423**, systemd unit `Description=` says **317**, and `book_arm/CLAUDE.md` says **221**. Four different numbers in the same project. The 244 claim is true for the bias-rated registry only. |
| "Updated every six hours by systemd timer" | **TRUE** | `botwave-bomba-pipeline.timer` is active, `OnCalendar=*-*-* 00,06,12,18:00:00`, last successful push 2026-05-10T19:23:31Z. |
| "Pipeline runs in seven stages" | **FALSE** | `bomba_pipeline.sh` invokes `global_ingestor.py` then `generate_feed.py` (monolith). The other five named modules (`coverage_mapper`, `blindspot_analyzer`, `framing_differ`, `bias_scorer`, `event_clusterer`) exist as standalone files but are never called by the systemd-fired pipeline. Their output artifacts on disk (`clusters.jsonl`, `blindspots_analysis.json`, `_blindspots.json`) are dated Apr 23–Apr 24 — they have not run since. |
| "broadcast.py serializes the pipeline output" | **FALSE** | `broadcast.py` exists at `Business/bots/botwave_news/distribution/broadcast.py` but is not invoked anywhere in the pipeline path. Serialization is done by `generate_feed.py`. Distribution to Discord+X is done by `broadcaster.py` (different file). |
| "Five-axis bias scoring (interventionist, zionist, atlanticist, statist, financialized)" | **PARTIALLY_TRUE** | The five axes ARE present per-source in `source_registry.json` and propagated into `latest.json`. But these are **hand-curated per-source ratings (a lookup), not per-article scoring**. The actual `bias_scorer.py` module scores single-axis -6 to +6 interventionism and isn't called by the pipeline. Methodology page is right that the five axes exist; misleading that they are "scored" by a pipeline stage. They are looked up from a static registry. |
| "AllSides + MBFC + hand-curated TELOS+PAI fingerprints" | **UNVERIFIABLE** | `source_registry.json` declares this in its `methodology` field but no per-source attribution traces which axis number came from which of the three sources. No AllSides/MBFC ingest script exists in the repo. The provenance is a claim, not a documented chain. |
| "Scores were generated on 2026-04-23 for the initial 208-source set and extended to 244 sources" | **PARTIALLY_TRUE** | `source_registry.json` is dated `2026-05-09T00:00:00Z` (`generated_at` field) with file mtime May 9 03:12. The 2026-04-23 date isn't on the served file. It may refer to the underlying axis ratings, but the file the public reads is newer than the claim. |
| "BE UNDENIABLE" | **AT_RISK** | Four of the seven claims above don't survive 90 seconds of file-system audit. The motto is currently undermined by the methodology page itself. |

---

## The smallest fix

**One commit, ~5 minutes.** Delete the fossil so the existing renderer fallback takes over.

```bash
cd /var/home/gringo/Botwave-Master/Archive/zombie760-staging/Zombie760.github.io
git rm botwavebomba/api/blindspots.json
git commit -m "fix(botwavebomba): remove stale blindspots fossil — derive from latest.json"
git push origin main
```

After this push, `blindspot.js:11-18` derives blindspots from `latest.json` on every page load. Blindspots page now reflects the same 6-hour refresh cycle as the front page. Number of em-dashes drops by one (`#bs-total-count`).

This does not fix the `_demoPayload()` silent-fallback path or the methodology overstatement, but it gets the most embarrassing artifact off the live site.

---

## The honest fix

Rewrite `about.html` § "The TELOS+PAI Pipeline" to match `bomba_pipeline.sh` line-for-line. The honest version is short and still impressive:

> **Pipeline (live, 2026-05-10):** `global_ingestor.py` pulls 423 RSS sources every six hours via `botwave-bomba-pipeline.timer`. `generate_feed.py` clusters the ingest by content hash, looks up each source's five-axis bias rating from a 244-source hand-curated registry (`source_registry.json`, methodology AllSides + MBFC + TELOS+PAI editorial review), flags blindspots where one bloc dominates coverage of a cluster, and writes the result to `api/latest.json`. Story-card PNGs are rendered for the top 200 stories. The staging repo is committed and pushed. Discord and Telegram digests follow. The whole loop runs in 20 minutes when it succeeds; recent runs have ~50 % failure rate on git-push timeouts and ingest timeouts, so the live `api/latest.json` is typically 1–12 hours stale rather than ≤6.

Claims to take down or qualify:
- "seven stages" — replace with the two stages that actually exist (ingest + monolith), or rebuild the five dormant modules and wire them
- "broadcast.py" — replace with the actual deploy path (`generate_feed.py` + `rsync` + `git push`)
- "five-axis bias scoring" — clarify it's a per-source lookup from a curated registry, not per-article scoring
- "244 sources" — clarify this is the bias-rated set; ingest is 423; pick which one to lead with and footnote the other
- "Scores generated 2026-04-23" — update to match the served file timestamp (2026-05-09), or restore the older file if Apr 23 is the canonical version
- "Updated every six hours" — qualify: "Target: every six hours. Actual: best-effort; current week shows ~50 % git-push failure rate, so visible staleness can run 1–12 hours."

The methodology page is currently a hostage-to-fortune for any reader who clones the repo. The page should be a weapon, not a vulnerability.

---

## Recommended next action

**HYBRID.**

1. **Today (10 minutes):** delete the `blindspots.json` fossil (above). Land Fix 1.
2. **This week (~2 hours):** rewrite `about.html` § Pipeline + § Methodology against the actual `bomba_pipeline.sh` and `source_registry.json`. Cut every claim that doesn't survive a `grep`. Add a "Last successful pipeline run" stat sourced from `latest.json#generated_at`.
3. **Decide (founder call):** of the five dormant modules (`coverage_mapper`, `blindspot_analyzer`, `framing_differ`, `bias_scorer`, `event_clusterer`):
   - **REPAIR path:** wire them into `bomba_pipeline.sh` as real stages, with each writing to a `api/<stage>.json` artifact. Methodology page becomes accurate without rewrite. Effort: ~1 week.
   - **RELABEL path:** keep `generate_feed.py` as the monolith, leave the modules as research code, fully rewrite methodology page around the monolith. Effort: ~2 hours.

The fastest route to "BE UNDENIABLE" credibility is RELABEL today + small REPAIR over a month: pick one dormant module per week, wire it as a real pipeline stage, update the methodology page paragraph. By end of month the page describes the code and the code matches the page. Either direction is fine; the only wrong move is leaving the gap open.

---

**VERDICT: STALE_BUT_HEALTHY**
**RECOMMENDED NEXT ACTION: HYBRID — RELABEL `about.html` this week, REPAIR one dormant module per week thereafter, after deleting the `blindspots.json` fossil today.**
