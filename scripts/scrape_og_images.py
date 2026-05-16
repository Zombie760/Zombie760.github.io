#!/usr/bin/env python3
"""
og:image backfill for book_arm/memory/news_cache.jsonl

Fetches the <head> section (max 8KB) of each article URL where image_url
is missing or null, extracts og:image / twitter:image, and writes an
updated news_cache.jsonl with the backfilled values.

Usage:
    python3 scrape_og_images.py [--limit N] [--cache-path PATH] [--output PATH]

    --limit N          Stop after processing N articles (smoke-test mode).
    --cache-path PATH  Path to news_cache.jsonl (default: book_arm/memory/news_cache.jsonl)
    --output PATH      Path for updated file (default: same dir as cache, _v2 suffix then
                       atomic replace of original when done)
"""

import argparse
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# ── constants ────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parents[2]          # Botwave-Master/
DEFAULT_CACHE = REPO_ROOT / "book_arm" / "memory" / "news_cache.jsonl"
DEFAULT_CHECKPOINT = REPO_ROOT / "book_arm" / "memory" / "_og_backfill_checkpoint.json"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
TIMEOUT = 8          # seconds per request
MAX_BYTES = 8192     # stop reading after 8 KB
SLEEP_MIN = 0.8
SLEEP_MAX = 1.5
PROGRESS_INTERVAL = 50
CHECKPOINT_INTERVAL = 100

# og:image meta tag patterns — ordered by preference
OG_PATTERNS = [
    re.compile(
        r'<meta[^>]+property=["\']og:image:secure_url["\'][^>]+content=["\']([^"\']+)["\']',
        re.IGNORECASE,
    ),
    re.compile(
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image:secure_url["\']',
        re.IGNORECASE,
    ),
    re.compile(
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
        re.IGNORECASE,
    ),
    re.compile(
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
        re.IGNORECASE,
    ),
    re.compile(
        r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
        re.IGNORECASE,
    ),
    re.compile(
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image["\']',
        re.IGNORECASE,
    ),
]

# og:video / twitter:player patterns — extracted in same single head fetch
OG_VIDEO_PATTERNS = [
    # og:video:url (highest fidelity — direct playable link)
    re.compile(
        r'<meta[^>]+property=["\']og:video:url["\'][^>]+content=["\']([^"\']+)["\']',
        re.IGNORECASE,
    ),
    re.compile(
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:video:url["\']',
        re.IGNORECASE,
    ),
    # og:video (fallback)
    re.compile(
        r'<meta[^>]+property=["\']og:video["\'][^>]+content=["\']([^"\']+)["\']',
        re.IGNORECASE,
    ),
    re.compile(
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:video["\']',
        re.IGNORECASE,
    ),
    # twitter:player embed URL
    re.compile(
        r'<meta[^>]+name=["\']twitter:player["\'][^>]+content=["\']([^"\']+)["\']',
        re.IGNORECASE,
    ),
    re.compile(
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:player["\']',
        re.IGNORECASE,
    ),
]

# YouTube watch/embed URL pattern — catches YouTube links in og:url or canonical
_YT_WATCH = re.compile(
    r'(?:youtube\.com/(?:watch\?v=|embed/)|youtu\.be/)([\w\-]{11})',
    re.IGNORECASE,
)

SKIP_URL_PREFIXES = ("#", "javascript:", "mailto:", "data:")


# ── helpers ──────────────────────────────────────────────────────────────────

def needs_backfill(article: dict) -> bool:
    """Return True if image_url is missing or explicitly null."""
    return article.get("image_url") is None


def url_is_fetchable(url: str) -> bool:
    if not url:
        return False
    for prefix in SKIP_URL_PREFIXES:
        if url.startswith(prefix):
            return False
    return url.startswith("http://") or url.startswith("https://")


def fetch_head_bytes(url: str) -> bytes | None:
    """
    Fetch up to MAX_BYTES from the URL.  Reads the raw stream and stops
    as soon as we have enough bytes or hit </head>.  Returns None on any
    error (timeout, 4xx, 5xx, SSL, etc.).
    """
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            # Only proceed on 2xx
            if resp.status // 100 != 2:
                return None
            buf = b""
            chunk_size = 512
            while len(buf) < MAX_BYTES:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                buf += chunk
                # Stop early once we've seen </head>
                if b"</head>" in buf.lower():
                    break
            return buf
    except Exception:
        return None


def extract_og_image(raw: bytes) -> str | None:
    """Try each OG/twitter pattern against the raw head bytes."""
    text = raw.decode("utf-8", errors="replace")
    for pattern in OG_PATTERNS:
        m = pattern.search(text)
        if m:
            img = m.group(1).strip()
            if img:
                return img
    return None


def extract_og_video(raw: bytes) -> str | None:
    """
    Extract a video URL from the same head bytes — no extra HTTP fetch.
    Priority: og:video:url → og:video → twitter:player → YouTube watch link.
    Returns a canonical YouTube watch URL if a video ID is found in any embed.
    """
    text = raw.decode("utf-8", errors="replace")
    for pattern in OG_VIDEO_PATTERNS:
        m = pattern.search(text)
        if m:
            vid_url = m.group(1).strip()
            if vid_url:
                # Normalise YouTube embed → watch URL
                yt = _YT_WATCH.search(vid_url)
                if yt:
                    return f"https://www.youtube.com/watch?v={yt.group(1)}"
                return vid_url
    # Last resort: any YouTube link in the head (og:url, canonical, etc.)
    yt = _YT_WATCH.search(text)
    if yt:
        return f"https://www.youtube.com/watch?v={yt.group(1)}"
    return None


def load_checkpoint(path: Path) -> dict:
    if path.exists():
        try:
            with open(path) as f:
                data = json.load(f)
            print(f"[resume] checkpoint loaded — {data.get('processed', 0)} already processed, "
                  f"{data.get('found', 0)} images found previously, "
                  f"{len(data.get('failed', []))} known failures")
            return data
        except Exception:
            pass
    return {"processed": 0, "found": 0, "failed": []}


def save_checkpoint(path: Path, checkpoint: dict) -> None:
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w") as f:
        json.dump(checkpoint, f, indent=2)
    os.replace(tmp, path)


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill og:image for news_cache.jsonl")
    parser.add_argument("--limit", type=int, default=0, metavar="N",
                        help="Stop after N articles (0 = no limit)")
    parser.add_argument("--cache-path", type=Path, default=DEFAULT_CACHE,
                        help="Path to news_cache.jsonl")
    parser.add_argument("--output", type=Path, default=None,
                        help="Output path (default: <cache>_v2.jsonl, then atomic replace)")
    args = parser.parse_args()

    cache_path: Path = args.cache_path.resolve()
    checkpoint_path: Path = DEFAULT_CHECKPOINT

    if args.output:
        output_path = args.output.resolve()
        atomic_replace = False
    else:
        output_path = cache_path.with_name(cache_path.stem + "_v2.jsonl")
        atomic_replace = True

    # ── load articles ────────────────────────────────────────────────────────
    print(f"[init] reading {cache_path}")
    articles: list[dict] = []
    with open(cache_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                articles.append(json.loads(line))
            except json.JSONDecodeError:
                pass

    total_articles = len(articles)
    print(f"[init] {total_articles} articles loaded")

    # ── identify targets ─────────────────────────────────────────────────────
    targets: list[int] = [
        i for i, a in enumerate(articles)
        if needs_backfill(a) and url_is_fetchable(a.get("url", ""))
    ]
    print(f"[init] {len(targets)} articles need og:image backfill")

    # ── checkpoint ───────────────────────────────────────────────────────────
    checkpoint = load_checkpoint(checkpoint_path)
    failed_set: set[str] = set(checkpoint.get("failed", []))

    # Build url→index map from already-written v2 (for partial resume)
    already_done_urls: set[str] = set()
    if output_path.exists():
        with open(output_path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    url = obj.get("url", "")
                    if url and obj.get("image_url"):
                        already_done_urls.add(url)
                except Exception:
                    pass
        print(f"[resume] {len(already_done_urls)} URLs already have image in output file")

    # ── filter targets: skip failed + already done ───────────────────────────
    work_targets = [
        i for i in targets
        if articles[i].get("url", "") not in failed_set
        and articles[i].get("url", "") not in already_done_urls
    ]

    if args.limit > 0:
        work_targets = work_targets[: args.limit]
        print(f"[smoke-test] --limit {args.limit}: will attempt {len(work_targets)} articles")

    # ── result mapping: url → image_url / video_url ─────────────────────────
    # Pre-populate from output file if resuming
    url_to_image: dict[str, str | None] = {}
    url_to_video: dict[str, str | None] = {}
    for i in targets:
        url = articles[i].get("url", "")
        if url in already_done_urls:
            url_to_image[url] = True  # placeholder; real value read back below

    # ── fetch loop ───────────────────────────────────────────────────────────
    session_processed = 0
    session_found = 0
    session_video_found = 0
    total_attempted = len(work_targets)

    for seq, idx in enumerate(work_targets, 1):
        article = articles[idx]
        url = article.get("url", "")

        raw = fetch_head_bytes(url)

        if raw is None:
            failed_set.add(url)
            checkpoint["failed"] = list(failed_set)
        else:
            img = extract_og_image(raw)
            vid = extract_og_video(raw)
            if img:
                url_to_image[url] = img
                session_found += 1
            else:
                # Successfully fetched but no og:image found — mark as attempted
                url_to_image[url] = None
                failed_set.add(url)   # won't retry on next run
                checkpoint["failed"] = list(failed_set)
            if vid:
                url_to_video[url] = vid
                session_video_found += 1

        session_processed += 1
        checkpoint["processed"] = checkpoint.get("processed", 0) + 1

        # Progress print
        pct_found = session_found / session_processed * 100 if session_processed else 0
        if session_processed % PROGRESS_INTERVAL == 0 or seq == total_attempted:
            print(
                f"[{seq}/{total_attempted}] "
                f"found: {session_found} ({pct_found:.1f}%) "
                f"| video: {session_video_found} "
                f"| failed: {len(failed_set)}"
            )

        # Checkpoint save
        if session_processed % CHECKPOINT_INTERVAL == 0:
            checkpoint["found"] = checkpoint.get("found", 0) + session_found
            save_checkpoint(checkpoint_path, checkpoint)

        # Rate limit
        if seq < total_attempted:
            time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))

    # ── write output ─────────────────────────────────────────────────────────
    print(f"\n[write] writing updated articles to {output_path}")

    with open(output_path, "w") as out_f:
        for article in articles:
            url = article.get("url", "")
            if url in url_to_image and url_to_image[url] and url_to_image[url] is not True:
                article["image_url"] = url_to_image[url]
            elif "image_url" not in article:
                article["image_url"] = None
            # video_url — write regardless so schema is consistent
            if url in url_to_video and url_to_video[url]:
                article["video_url"] = url_to_video[url]
            elif "video_url" not in article:
                article["video_url"] = None
            out_f.write(json.dumps(article, ensure_ascii=False) + "\n")

    # ── checkpoint final save ────────────────────────────────────────────────
    checkpoint["found"] = checkpoint.get("found", 0) + session_found
    checkpoint["failed"] = list(failed_set)
    save_checkpoint(checkpoint_path, checkpoint)

    # ── atomic replace (full run only) ───────────────────────────────────────
    if atomic_replace and args.limit == 0:
        backup = cache_path.with_name(cache_path.stem + "_backup.jsonl")
        os.replace(cache_path, backup)
        os.replace(output_path, cache_path)
        print(f"[done] atomically replaced {cache_path.name} (backup at {backup.name})")
    else:
        print(f"[done] output written to {output_path} (no atomic replace — smoke-test or --output mode)")

    # ── summary ──────────────────────────────────────────────────────────────
    total_processed = session_processed
    success_rate = session_found / total_processed * 100 if total_processed else 0
    print("\n=== SUMMARY ===")
    print(f"  Articles attempted this run : {total_processed}")
    print(f"  og:image found              : {session_found}")
    print(f"  Success rate                : {success_rate:.1f}%")
    print(f"  Cumulative failures (skip)  : {len(failed_set)}")
    print(f"  Checkpoint                  : {checkpoint_path}")
    if args.limit == 0:
        print(f"  Cache file                  : {cache_path} (updated)")
    else:
        print(f"  Output file                 : {output_path} (smoke-test — original untouched)")


if __name__ == "__main__":
    main()
