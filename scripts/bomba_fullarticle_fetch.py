#!/var/home/gringo/Botwave-Master/botwave-bounty/.venv/bin/python3
"""
BOMBA full-article enrichment — companion to bomba_pipeline.sh.

For a curated allow-list of paywalled / JS-rendered / anti-bot sources, fetch
the full article body via Playwright (Chromium) routed through wavesox
(socks5://localhost:9060), extract the main text with lxml + CSS selectors,
and write a sidecar JSONL at botwavebomba/data/bomba_fullarticles.jsonl.

This script is ADDITIVE and OPTIONAL. It does NOT modify the existing pipeline,
source list, or feed schema. Operator wires it in after review.

Hard rules (enforced):
  - Rate limit: >=5s between fetches per source.
  - Default cap: 5 articles per source per run.
  - Time horizon: only RSS entries published in the last LOOKBACK_HOURS.
  - Skip URL if already enriched in this JSONL (idempotent dedupe by url).
  - Stealth + proxy required: wavesox SOCKS5 on localhost:9060.

Usage:
  python3 bomba_fullarticle_fetch.py --dry-run                # plan only
  python3 bomba_fullarticle_fetch.py --dry-run --source bbc   # plan one source
  python3 bomba_fullarticle_fetch.py --source bbc             # fetch one source
  python3 bomba_fullarticle_fetch.py                          # fetch all allow-list
  python3 bomba_fullarticle_fetch.py --max-per-source 3 --lookback-hours 12

Dependencies (all already in botwave-bounty/.venv):
  - playwright  (>= 1.58)
  - lxml

No new pip deps. No trafilatura. No bs4. lxml + Chromium-rendered DOM is enough.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import urlparse

# ── Paths ────────────────────────────────────────────────────────────────────
REPO = Path("/var/home/gringo/Botwave-Master")
BOMBA_ROOT = REPO / "zombie760.github.io" / "botwavebomba"
DATA_DIR = BOMBA_ROOT / "data"
OUT_JSONL = DATA_DIR / "bomba_fullarticles.jsonl"
SOURCES_GLOBAL = REPO / "book_arm" / "memory" / "sources_global.json"
LOG_DIR = Path(os.environ.get("XDG_STATE_HOME", str(Path.home() / ".local/state"))) / "botwave"
LOG_FILE = LOG_DIR / "bomba_fullarticle_fetch.log"

# ── Wavesox proxy (operator's upstream masking) ──────────────────────────────
WAVESOX_PROXY = "socks5://localhost:9060"

# ── Tunables ─────────────────────────────────────────────────────────────────
DEFAULT_LOOKBACK_HOURS = 6        # match BOMBA timer cadence
DEFAULT_MAX_PER_SOURCE = 5        # cap per run, per source
DEFAULT_RATE_LIMIT_SEC = 5.0      # >=5s between page loads
PAGE_TIMEOUT_MS = 25_000
RSS_FETCH_TIMEOUT_SEC = 15

# ── Allow-list of paywalled / JS-rendered / anti-bot sources ─────────────────
# Each entry references a source `id` from sources_global.json (the 492).
# `selectors` is an ordered list of CSS selectors tried in order; the first
# match with > MIN_BODY_CHARS of text wins. `block_resources` cuts page weight.
MIN_BODY_CHARS = 400

ALLOW_LIST: dict[str, dict] = {
    "bbc_news": {
        "selectors": [
            "article[data-component='text-block'] >> *",
            "article",
            "[data-component='text-block']",
            "main",
        ],
        "selectors_simple": [
            "article",
            "main[role=main]",
            "[data-component='text-block']",
        ],
    },
    "reuters": {
        "selectors_simple": [
            "div[data-testid='ArticleBody']",
            "div.article-body__content",
            "article",
            "main",
        ],
    },
    "ap_news": {
        "selectors_simple": [
            "div.RichTextStoryBody",
            "div.RichTextBody",
            "article",
            "main",
        ],
    },
    "scmp": {
        "selectors_simple": [
            "div.article__body",
            "div[itemprop='articleBody']",
            "article",
            "main",
        ],
    },
    "xinhua": {
        "selectors_simple": [
            "div#detail",
            "div.article-content",
            "div.content",
            "article",
        ],
    },
    "global_times": {
        "selectors_simple": [
            "div.article_content",
            "div.article_right",
            "div.content",
            "article",
        ],
    },
    "aljazeera": {
        "selectors_simple": [
            "div.wysiwyg",
            "main#main-content-area",
            "article",
        ],
    },
    "tass": {
        "selectors_simple": [
            "div.text-content",
            "div.news-text",
            "article",
            "main",
        ],
    },
    "guardian": {
        "selectors_simple": [
            "div[itemprop='articleBody']",
            "div.article-body-commercial-selector",
            "main#maincontent",
            "article",
        ],
    },
    "nytimes": {
        "selectors_simple": [
            "section[name='articleBody']",
            "div.StoryBodyCompanionColumn",
            "article",
        ],
    },
}


# ── Logging (mirrors bomba_pipeline.sh: ~/.local/state/botwave/) ─────────────
def _log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


# ── Source registry helpers ──────────────────────────────────────────────────
@dataclass
class SourceRef:
    id: str
    name: str
    url_home: str
    feed_url: str
    selectors: list[str] = field(default_factory=list)


def load_allow_sources(source_filter: Optional[str]) -> list[SourceRef]:
    if not SOURCES_GLOBAL.exists():
        _log(f"BLOCKER: sources_global.json not found at {SOURCES_GLOBAL}")
        sys.exit(2)
    raw = json.loads(SOURCES_GLOBAL.read_text(encoding="utf-8"))
    by_id = {s["id"]: s for s in raw.get("sources", [])}
    refs: list[SourceRef] = []
    wanted = set(ALLOW_LIST.keys())
    if source_filter:
        if source_filter not in ALLOW_LIST:
            _log(f"BLOCKER: --source '{source_filter}' not in allow-list: {sorted(ALLOW_LIST)}")
            sys.exit(2)
        wanted = {source_filter}
    for sid in sorted(wanted):
        s = by_id.get(sid)
        if not s:
            _log(f"WARN: allow-list id '{sid}' not found in sources_global.json — skipping")
            continue
        cfg = ALLOW_LIST[sid]
        refs.append(SourceRef(
            id=sid,
            name=s.get("name", sid),
            url_home=s.get("url_home", ""),
            feed_url=s.get("feed_url", ""),
            selectors=cfg.get("selectors_simple", cfg.get("selectors", ["article", "main"])),
        ))
    return refs


# ── RSS parsing (stdlib only — no feedparser dep) ────────────────────────────
def _parse_rss_date(s: str) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = parsedate_to_datetime(s)
        if dt and dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (TypeError, ValueError):
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S"):
        try:
            dt = datetime.strptime(s.strip(), fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def fetch_recent_urls(feed_url: str, lookback_hours: int, limit: int) -> list[dict]:
    """Pull recent <item>/<entry> URLs from an RSS or Atom feed via stdlib.

    Returns list of {url, title, published_iso}.
    """
    if not feed_url:
        return []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)
    req = urllib.request.Request(
        feed_url,
        headers={"User-Agent": "BOTWAVE-BOMBA-fullarticle/1.0 (+https://zombie760.github.io)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=RSS_FETCH_TIMEOUT_SEC) as resp:
            body = resp.read()
    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        _log(f"  RSS fetch failed for {feed_url}: {e}")
        return []
    try:
        root = ET.fromstring(body)
    except ET.ParseError as e:
        _log(f"  RSS parse failed for {feed_url}: {e}")
        return []

    items: list[dict] = []
    # RSS 2.0 <item>
    for item in root.iter("item"):
        link = (item.findtext("link") or "").strip()
        title = (item.findtext("title") or "").strip()
        pub = item.findtext("pubDate") or item.findtext("{http://purl.org/dc/elements/1.1/}date") or ""
        items.append({"url": link, "title": title, "published_raw": pub})
    # Atom <entry>
    atom_ns = "{http://www.w3.org/2005/Atom}"
    for entry in root.iter(atom_ns + "entry"):
        link_el = entry.find(atom_ns + "link")
        link = (link_el.get("href") if link_el is not None else "") or ""
        title = (entry.findtext(atom_ns + "title") or "").strip()
        pub = entry.findtext(atom_ns + "published") or entry.findtext(atom_ns + "updated") or ""
        items.append({"url": link.strip(), "title": title, "published_raw": pub})

    recent: list[dict] = []
    for it in items:
        if not it["url"]:
            continue
        dt = _parse_rss_date(it["published_raw"])
        if dt and dt < cutoff:
            continue
        it["published_iso"] = dt.isoformat() if dt else None
        recent.append(it)
        if len(recent) >= limit:
            break
    return recent


# ── Output dedupe ────────────────────────────────────────────────────────────
def load_existing_urls() -> set[str]:
    seen: set[str] = set()
    if not OUT_JSONL.exists():
        return seen
    with OUT_JSONL.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            u = rec.get("url")
            if u:
                seen.add(u)
    return seen


def append_record(rec: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with OUT_JSONL.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


# ── Extraction (lxml from rendered DOM) ──────────────────────────────────────
def extract_body_text(html_str: str, selectors: list[str]) -> tuple[str, str]:
    """Return (text, selector_used). Empty string if nothing matched."""
    try:
        from lxml import html as lhtml
    except ImportError:
        _log("BLOCKER: lxml not available in this venv")
        return "", ""
    try:
        doc = lhtml.fromstring(html_str)
    except (ValueError, lhtml.etree.ParserError):
        return "", ""

    # Strip noise
    for noise in doc.xpath("//script | //style | //noscript | //nav | //footer | //aside | //form"):
        noise.getparent().remove(noise) if noise.getparent() is not None else None

    for sel in selectors:
        try:
            nodes = doc.cssselect(sel)
        except Exception:
            continue
        for node in nodes:
            text = " ".join(node.text_content().split())
            if len(text) >= MIN_BODY_CHARS:
                return text, sel
    # Last-resort fallback: pick the largest <p>-dense block under <body>
    best_text = ""
    for cand in doc.xpath("//body//*[self::article or self::main or self::div or self::section]"):
        paragraphs = cand.xpath(".//p")
        if len(paragraphs) < 3:
            continue
        text = " ".join(" ".join(p.text_content().split()) for p in paragraphs)
        if len(text) > len(best_text):
            best_text = text
    if len(best_text) >= MIN_BODY_CHARS:
        return best_text, "fallback:p-dense-block"
    return "", ""


# ── Playwright fetch through wavesox ─────────────────────────────────────────
async def fetch_article(playwright_p, src: SourceRef, item: dict) -> Optional[dict]:
    url = item["url"]
    browser = await playwright_p.chromium.launch(
        headless=True,
        proxy={"server": WAVESOX_PROXY},
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
        ],
    )
    try:
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1366, "height": 900},
            locale="en-US",
        )
        # Block heavy resource types we don't need
        async def _route(route):
            if route.request.resource_type in ("image", "media", "font", "stylesheet"):
                await route.abort()
            else:
                await route.continue_()
        await context.route("**/*", _route)

        page = await context.new_page()
        try:
            await page.goto(url, timeout=PAGE_TIMEOUT_MS, wait_until="domcontentloaded")
        except Exception as e:
            _log(f"  goto failed [{src.id}] {url}: {e}")
            return None
        try:
            await page.wait_for_selector("body", timeout=5_000)
        except Exception:
            pass

        html_str = await page.content()
        text, sel = extract_body_text(html_str, src.selectors)
        if not text:
            _log(f"  extract empty [{src.id}] {url} (no selector matched)")
            return None
        return {
            "url": url,
            "source_id": src.id,
            "source_name": src.name,
            "title": item.get("title", ""),
            "published": item.get("published_iso"),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "selector_used": sel,
            "body_chars": len(text),
            "body": text,
            "fetcher_version": "bomba_fullarticle_fetch/1.0",
            "via": WAVESOX_PROXY,
        }
    finally:
        await browser.close()


# ── Orchestrator ─────────────────────────────────────────────────────────────
async def run(refs: list[SourceRef], lookback_hours: int, max_per_source: int,
              rate_limit_sec: float, dry_run: bool) -> int:
    seen_urls = load_existing_urls()
    _log(f"loaded existing: {len(seen_urls)} urls already enriched")

    plan: list[tuple[SourceRef, dict]] = []
    for src in refs:
        items = fetch_recent_urls(src.feed_url, lookback_hours, limit=max_per_source * 4)
        fresh = [i for i in items if i["url"] not in seen_urls][:max_per_source]
        _log(f"plan [{src.id}]: {len(fresh)} candidate URL(s) (feed had {len(items)} recent)")
        for it in fresh:
            plan.append((src, it))

    if dry_run:
        _log(f"DRY-RUN: {len(plan)} article(s) would be fetched. Not launching browser.")
        for src, it in plan:
            print(f"  [{src.id}] {it.get('published_iso','-')}  {it['url']}")
        return 0

    if not plan:
        _log("nothing fresh to fetch.")
        return 0

    try:
        from playwright.async_api import async_playwright
    except ImportError as e:
        _log(f"BLOCKER: playwright not importable in this venv: {e}")
        return 3

    fetched = 0
    fails = 0
    async with async_playwright() as pw:
        for i, (src, item) in enumerate(plan):
            if i > 0:
                await asyncio.sleep(rate_limit_sec)
            _log(f"fetch {i+1}/{len(plan)} [{src.id}] {item['url']}")
            try:
                rec = await fetch_article(pw, src, item)
            except Exception as e:
                _log(f"  exception [{src.id}] {item['url']}: {e}")
                rec = None
            if rec:
                append_record(rec)
                fetched += 1
            else:
                fails += 1

    _log(f"done. fetched={fetched} failed={fails} out={OUT_JSONL}")
    return 0 if fetched > 0 or fails == 0 else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="BOMBA full-article enrichment via stealth+wavesox.")
    ap.add_argument("--source", help="single source id from allow-list (default: all)")
    ap.add_argument("--lookback-hours", type=int, default=DEFAULT_LOOKBACK_HOURS,
                    help=f"only fetch articles published within N hours (default {DEFAULT_LOOKBACK_HOURS})")
    ap.add_argument("--max-per-source", type=int, default=DEFAULT_MAX_PER_SOURCE,
                    help=f"cap per source per run (default {DEFAULT_MAX_PER_SOURCE})")
    ap.add_argument("--rate-limit-sec", type=float, default=DEFAULT_RATE_LIMIT_SEC,
                    help=f"min seconds between page loads (default {DEFAULT_RATE_LIMIT_SEC})")
    ap.add_argument("--dry-run", action="store_true",
                    help="print URLs that would be fetched; do not launch browser")
    ap.add_argument("--list-sources", action="store_true",
                    help="print the allow-list and exit")
    args = ap.parse_args()

    if args.list_sources:
        for sid in sorted(ALLOW_LIST):
            print(sid)
        return 0

    if args.rate_limit_sec < 5.0:
        _log(f"WARN: --rate-limit-sec {args.rate_limit_sec} < 5s floor; clamping to 5s.")
        args.rate_limit_sec = 5.0

    refs = load_allow_sources(args.source)
    if not refs:
        _log("BLOCKER: no resolvable sources from allow-list.")
        return 2

    _log(f"start: sources={[r.id for r in refs]} lookback={args.lookback_hours}h "
         f"cap={args.max_per_source}/src rate={args.rate_limit_sec}s dry_run={args.dry_run}")
    return asyncio.run(run(refs, args.lookback_hours, args.max_per_source,
                           args.rate_limit_sec, args.dry_run))


if __name__ == "__main__":
    sys.exit(main())
