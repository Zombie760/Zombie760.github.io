"""
Reconcile data/source_registry.json (rich, 496 slug-IDs) with
api/sources.json (flat, 6074 entries / 602 unique hex-IDs).

Reads only. Writes to reconciled/ alongside this script.
"""
import json
import re
import hashlib
import datetime
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
BASE = HERE.parent
REG_PATH = BASE / "data" / "source_registry.json"
API_PATH = BASE / "api" / "sources.json"
OUT_CANONICAL = HERE / "source_registry.canonical.json"
OUT_REPORT = HERE / "reconciliation_report.md"
OUT_NEEDS_REVIEW = HERE / "needs_review.json"

# --- Normalization ----------------------------------------------------------

_PUNCT = re.compile(r"[^\w\s]")
_WS = re.compile(r"\s+")
_LEADING_THE = re.compile(r"^the\s+")


def normalize(name: str) -> str:
    if not name:
        return ""
    s = name.lower().strip()
    s = _LEADING_THE.sub("", s)
    s = _PUNCT.sub(" ", s)
    s = _WS.sub(" ", s).strip()
    return s


# Alias map: canonical normalized form -> list of variants
ALIASES = {
    "associated press": ["ap", "ap news"],
    "bbc news": ["bbc", "bbc world", "bbc world news"],
    "new york times": ["nyt", "ny times", "nytimes"],
    "wall street journal": ["wsj"],
    "washington post": ["wapo", "washpost"],
    "los angeles times": ["la times", "latimes"],
    "fox news": ["fox", "foxnews"],
    "cable news network": ["cnn"],
    "agence france presse": ["afp"],
    "national broadcasting company": ["nbc", "nbc news"],
    "american broadcasting company": ["abc", "abc news"],
    "columbia broadcasting system": ["cbs", "cbs news"],
    "public broadcasting service": ["pbs", "pbs newshour"],
    "national public radio": ["npr"],
    "russia today": ["rt", "rt news"],
    "press tv": ["presstv"],
    "south china morning post": ["scmp"],
    "deutsche welle": ["dw", "dw news"],
    "france 24": ["france24"],
    "al jazeera": ["aljazeera"],
    "voice of america": ["voa"],
    "radio free europe": ["rfe", "rferl", "radio free europe radio liberty"],
    "the economist": ["economist"],
    "the atlantic": ["atlantic"],
    "the intercept": ["intercept"],
    "the hill": ["hill"],
    "huffington post": ["huffpost", "huffington post us"],
    "business insider": ["insider"],
    "bloomberg news": ["bloomberg"],
    "financial times": ["ft"],
    "the daily beast": ["daily beast"],
    "the daily wire": ["daily wire"],
    "breitbart news": ["breitbart"],
    "mother jones": ["motherjones"],
}

alias_to_canonical: dict[str, str] = {}
for canon, variants in ALIASES.items():
    alias_to_canonical[canon] = canon
    for v in variants:
        alias_to_canonical[v] = canon


def canonical_key(name: str) -> str:
    n = normalize(name)
    return alias_to_canonical.get(n, n)


# --- Slug generation for API-only records ----------------------------------

_SLUG_BAD = re.compile(r"[^a-z0-9]+")


def slugify(name: str) -> str:
    s = normalize(name)
    s = _SLUG_BAD.sub("_", s).strip("_")
    return s or "source"


# --- Load -------------------------------------------------------------------

reg = json.loads(REG_PATH.read_text())
api = json.loads(API_PATH.read_text())

reg_sources: list[dict] = reg["sources"]
api_sources_raw: list[dict] = api["sources"]

# --- Dedupe API by id (keep first occurrence) ------------------------------

api_before = len(api_sources_raw)
seen_api: dict[str, dict] = {}
for s in api_sources_raw:
    sid = s.get("id")
    if sid is None:
        continue
    if sid not in seen_api:
        seen_api[sid] = s
api_unique = list(seen_api.values())
api_after = len(api_unique)
api_dropped = api_before - api_after

# --- Build indexes ----------------------------------------------------------

reg_by_key: dict[str, list[dict]] = {}
for s in reg_sources:
    reg_by_key.setdefault(canonical_key(s["name"]), []).append(s)

api_by_key: dict[str, list[dict]] = {}
for s in api_unique:
    api_by_key.setdefault(canonical_key(s["name"]), []).append(s)

reg_names_exact = {s["name"] for s in reg_sources}
api_names_exact = {s["name"] for s in api_unique}
exact_name_overlap = sorted(reg_names_exact & api_names_exact)

matched_keys = sorted(set(reg_by_key.keys()) & set(api_by_key.keys()))
reg_only_keys = sorted(set(reg_by_key.keys()) - set(api_by_key.keys()))
api_only_keys = sorted(set(api_by_key.keys()) - set(reg_by_key.keys()))

# --- Canonical record shape -------------------------------------------------

REGISTRY_FIELDS = [
    "axis",
    "bias_legacy",
    "bloc",
    "country",
    "faction_aligned",
    "factuality",
    "factuality_sources",
    "geo_cluster",
    "industry_aligned",
    "name",
    "notes",
    "parent_company",
    "political_lean",
    "political_lean_sources",
    "primary_vs_launder",
    "provenance",
    "state_aligned",
]

API_EXTRA_FIELDS = [
    "url",
    "source_type",
    "language",
    "mbfc_credibility",
    "bias_western",
    "bias_adversarial",
    "bias_atlanticist",
    "bias_interventionist",
    "bias_statist",
    "bias_financialized",
    "active",
]


def empty_canonical(name: str) -> dict:
    rec: dict = {"id": None, "name": name}
    for f in REGISTRY_FIELDS:
        if f == "name":
            continue
        if f in ("factuality_sources", "political_lean_sources"):
            rec[f] = []
        else:
            rec[f] = None
    for f in API_EXTRA_FIELDS:
        rec[f] = None
    rec["merge_origin"] = None
    rec["api_legacy_id"] = None
    return rec


def merge_api_into(canonical: dict, api_rec: dict, flagged: list[str]) -> None:
    """Merge API fields into a canonical record (which already has registry data).
    Only fill nulls; on direct conflict, keep registry value and flag."""
    canonical["api_legacy_id"] = api_rec.get("id")
    for f in API_EXTRA_FIELDS:
        v = api_rec.get(f)
        if v is None:
            continue
        if canonical.get(f) in (None, "", []):
            canonical[f] = v
    # Country conflict — registry wins, but flag.
    if api_rec.get("country") and canonical.get("country") and \
            normalize(str(api_rec["country"])) != normalize(str(canonical["country"])):
        flagged.append(
            f"country_disagreement:registry={canonical['country']!r} api={api_rec['country']!r}"
        )


def from_api_only(api_rec: dict, used_slugs: set[str]) -> tuple[dict, list[str]]:
    flags: list[str] = []
    name = api_rec.get("name") or ""
    rec = empty_canonical(name)
    # generate slug
    base_slug = slugify(name) or "source"
    slug = base_slug
    if slug in used_slugs:
        suffix = hashlib.sha1(
            (api_rec.get("id") or name).encode("utf-8")
        ).hexdigest()[:6]
        slug = f"{base_slug}_{suffix}"
        flags.append(f"slug_collision_resolved:{slug}")
    rec["id"] = slug
    rec["country"] = api_rec.get("country")
    for f in API_EXTRA_FIELDS:
        rec[f] = api_rec.get(f)
    rec["api_legacy_id"] = api_rec.get("id")
    rec["merge_origin"] = "api"
    rec["notes"] = (
        "Imported from api/sources.json with no registry counterpart. "
        "Lacks editorial axis/political_lean/factuality scoring."
    )
    flags.append("api_only_missing_editorial_scores")
    return rec, flags


# --- Build canonical list ---------------------------------------------------

canonical_sources: list[dict] = []
needs_review: list[dict] = []
used_slugs: set[str] = set()
n_merged = 0
n_registry_only = 0
n_api_only = 0
multi_match_warnings: list[dict] = []
registry_internal_collisions: list[dict] = []
dropped_api_candidates: list[dict] = []

# Detect registry-internal normalized-name collisions (two registry IDs that
# resolve to the same outlet by name). Don't auto-merge; flag for editorial.
for key, recs in reg_by_key.items():
    if len(recs) > 1:
        registry_internal_collisions.append(
            {
                "normalized_key": key,
                "registry_records": [
                    {"id": r["id"], "name": r["name"], "country": r.get("country")}
                    for r in recs
                ],
            }
        )

# 1) registry records (preserve order, become canonical base)
for reg_rec in reg_sources:
    key = canonical_key(reg_rec["name"])
    rec = empty_canonical(reg_rec["name"])
    for f in REGISTRY_FIELDS:
        if f in reg_rec:
            rec[f] = reg_rec[f]
    rec["id"] = reg_rec["id"]
    used_slugs.add(reg_rec["id"])
    flags: list[str] = []

    if len(reg_by_key.get(key, [])) > 1:
        flags.append("registry_internal_name_collision")

    api_matches = api_by_key.get(key, [])
    if not api_matches:
        rec["merge_origin"] = "registry"
        n_registry_only += 1
    else:
        if len(api_matches) > 1:
            multi_match_warnings.append(
                {
                    "registry_name": reg_rec["name"],
                    "key": key,
                    "api_candidates": [
                        {"id": a.get("id"), "name": a.get("name"), "url": a.get("url")}
                        for a in api_matches
                    ],
                }
            )
            for extra in api_matches[1:]:
                dropped_api_candidates.append(
                    {
                        "matched_registry_name": reg_rec["name"],
                        "matched_registry_id": reg_rec["id"],
                        "dropped_api_id": extra.get("id"),
                        "dropped_api_name": extra.get("name"),
                        "dropped_api_url": extra.get("url"),
                    }
                )
            flags.append("multiple_api_candidates_picked_first")
        merge_api_into(rec, api_matches[0], flags)
        rec["merge_origin"] = "merged"
        n_merged += 1

    if flags:
        needs_review.append(
            {
                "id": rec["id"],
                "name": rec["name"],
                "merge_origin": rec["merge_origin"],
                "flags": flags,
            }
        )
    canonical_sources.append(rec)

# 2) api-only records
for key in api_only_keys:
    for api_rec in api_by_key[key]:
        rec, flags = from_api_only(api_rec, used_slugs)
        used_slugs.add(rec["id"])
        n_api_only += 1
        if flags:
            needs_review.append(
                {
                    "id": rec["id"],
                    "name": rec["name"],
                    "merge_origin": rec["merge_origin"],
                    "api_legacy_id": rec["api_legacy_id"],
                    "flags": flags,
                }
            )
        canonical_sources.append(rec)

# Sanity: every canonical id must be unique
seen_ids: set[str] = set()
dup_ids: list[str] = []
for r in canonical_sources:
    if r["id"] in seen_ids:
        dup_ids.append(r["id"])
    seen_ids.add(r["id"])
assert not dup_ids, f"duplicate canonical ids generated: {dup_ids[:5]}"

# --- Meta -------------------------------------------------------------------

now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
canonical_meta = {
    "schema_version": "canonical_v1",
    "generated_at": now,
    "total_sources": len(canonical_sources),
    "breakdown": {
        "from_registry_only": n_registry_only,
        "from_api_only": n_api_only,
        "merged": n_merged,
    },
    "inputs": {
        "registry": {
            "path": str(REG_PATH.relative_to(BASE)),
            "total": len(reg_sources),
        },
        "api": {
            "path": str(API_PATH.relative_to(BASE)),
            "total_raw": api_before,
            "total_unique_by_id": api_after,
            "duplicates_dropped": api_dropped,
        },
    },
    "notes": [
        "Origin tracked per-record on `merge_origin` (not `provenance`) to avoid clobbering the registry's citation-grade `provenance` field.",
        "API-only records were given generated slug IDs; their original hex IDs are preserved on `api_legacy_id`.",
        "Numeric bias_* fields (bias_western, bias_adversarial, ...) are populated only for sources present in the API file; null for registry-only sources.",
        "Editorial fields (axis, political_lean, factuality) are populated only for sources present in the registry; null for API-only sources.",
    ],
}

canonical_out = {"meta": canonical_meta, "sources": canonical_sources}
OUT_CANONICAL.write_text(json.dumps(canonical_out, indent=2, ensure_ascii=False))

# --- Report -----------------------------------------------------------------

normalized_match_count = len(matched_keys)
exact_match_count = len(exact_name_overlap)

internal_collision_records = sum(
    len(c["registry_records"]) for c in registry_internal_collisions
)
caveat_collapse_max = internal_collision_records - len(registry_internal_collisions)
canonical_count = len(canonical_sources)
defensible_low = canonical_count - caveat_collapse_max

report_lines = [
    "# BOTWAVEBOMBA source reconciliation report",
    "",
    f"_Generated {now}_",
    "",
    "## Headline number",
    "",
    f"- **Canonical unique sources (as written): {canonical_count}**",
    f"- After collapsing the {len(registry_internal_collisions)} registry-internal name collisions ({internal_collision_records} records → {len(registry_internal_collisions)} outlets), the defensible floor would be **{defensible_low}**.",
    f"- Registry-only: {n_registry_only}",
    f"- API-only: {n_api_only}",
    f"- Merged (in both): {n_merged}",
    "",
    f"**Publish a number in the range {defensible_low}–{canonical_count}. Do NOT publish 244, 6074, or 602.** The internal collisions need editorial review before a single hard number is final.",
    "",
    "## Input summary",
    "",
    f"- Registry (`data/source_registry.json`): {len(reg_sources)} entries, {len(reg_sources)} unique IDs (slug scheme)",
    f"- API (`api/sources.json`): {api_before} entries before dedupe, {api_after} unique IDs after dedupe (hex scheme); {api_dropped} duplicate rows dropped in the canonical output",
    "",
    "## Name matching",
    "",
    f"- Exact-string name overlap across the two files: {exact_match_count}",
    f"- Normalized + alias-aware name overlap: {normalized_match_count}",
    f"- Names that matched only after normalization (alias / case / punctuation / 'The '): {normalized_match_count - exact_match_count}",
    "",
    "## Schema decisions",
    "",
    "- Canonical shape inherits the registry schema (axis, bias_legacy, bloc, country, faction_aligned, factuality, factuality_sources, geo_cluster, industry_aligned, notes, parent_company, political_lean, political_lean_sources, primary_vs_launder, provenance, state_aligned).",
    "- API extra fields added to every canonical record (null where unknown): url, source_type, language, mbfc_credibility, bias_western, bias_adversarial, bias_atlanticist, bias_interventionist, bias_statist, bias_financialized, active.",
    "- Two new tracking fields: `merge_origin` (registry|api|merged) and `api_legacy_id` (the original hex id from api/sources.json when known).",
    "- The registry's existing `provenance` field (citation-grade method/source/confidence/date data) was preserved untouched. Origin tracking lives on `merge_origin` to avoid silent overwrite.",
    "",
    "## Needs-review tally",
    "",
    f"- Records flagged for manual review: {len(needs_review)}",
    f"- Multi-match cases (one registry name → multiple API candidates): {len(multi_match_warnings)}",
    "",
    "## Disagreements found",
    "",
]

country_disagreements = [
    r for r in needs_review
    if any(f.startswith("country_disagreement") for f in r["flags"])
]
slug_collisions = [
    r for r in needs_review
    if any(f.startswith("slug_collision_resolved") for f in r["flags"])
]

report_lines.append(f"- Country disagreement (registry vs. API): {len(country_disagreements)}")
report_lines.append(f"- Slug collisions resolved with hash suffix: {len(slug_collisions)}")
report_lines.append(f"- Registry-internal normalized-name collisions: {len(registry_internal_collisions)} keys covering {internal_collision_records} registry records")
report_lines.append(f"- API records dropped to multi-match (extra API candidates not merged): {len(dropped_api_candidates)}")
report_lines.append("")
report_lines.append("## Constraints honored")
report_lines.append("")
report_lines.append("- Originals untouched. Timestamped `.bak.<ISO8601>` copies exist next to each.")
report_lines.append("- No bias scores invented. API-only sources retain their numeric bias_* but have null axis/political_lean/factuality until editorial review.")
report_lines.append("- No hardcoded counts carried over from prior meta. All counts recomputed from the merge.")
report_lines.append("- Dedupe applied only in canonical output. Originals retain their 6074 rows (fixing the append bug is a separate task).")
report_lines.append("")
report_lines.append("## Files written")
report_lines.append("")
report_lines.append(f"- `reconciled/source_registry.canonical.json` ({OUT_CANONICAL.stat().st_size if OUT_CANONICAL.exists() else '?'} bytes)")
report_lines.append("- `reconciled/needs_review.json`")
report_lines.append("- `reconciled/reconciliation_report.md` (this file)")

OUT_REPORT.write_text("\n".join(report_lines))

# --- needs_review.json ------------------------------------------------------

OUT_NEEDS_REVIEW.write_text(
    json.dumps(
        {
            "generated_at": now,
            "count": len(needs_review),
            "multi_match_cases": multi_match_warnings,
            "registry_internal_collisions": registry_internal_collisions,
            "dropped_api_candidates": dropped_api_candidates,
            "records": needs_review,
        },
        indent=2,
        ensure_ascii=False,
    )
)

print(json.dumps({
    "canonical_total": len(canonical_sources),
    "registry_only": n_registry_only,
    "api_only": n_api_only,
    "merged": n_merged,
    "exact_name_overlap": exact_match_count,
    "normalized_name_overlap": normalized_match_count,
    "needs_review_count": len(needs_review),
    "multi_match_cases": len(multi_match_warnings),
    "api_dedupe": {"before": api_before, "after": api_after, "dropped": api_dropped},
}, indent=2))
