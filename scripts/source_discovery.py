#!/usr/bin/env python3
"""
BOTWAVEBOMBA Source Discovery Tool
Scrapes Media Bias/Fact Check for validated news sources, discovers RSS feeds,
deduplicates against sources_global.json, writes to sources_discovered.jsonl.

Usage:
    python3 source_discovery.py --mbfc --limit 200
    python3 source_discovery.py --status
"""

import argparse
import concurrent.futures
import json
import logging
import re
import signal
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse, urljoin

import httpx
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent.parent  # Botwave-Master
SOURCES_GLOBAL = REPO_ROOT / "book_arm/memory/sources_global.json"
SOURCES_DISCOVERED = REPO_ROOT / "book_arm/memory/sources_discovered.jsonl"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("source_discovery")

# ---------------------------------------------------------------------------
# Network clients
# ---------------------------------------------------------------------------
# Domains known to stall TLS handshakes indefinitely (state-run / geo-blocked)
# These bypass normal timeout and must be skipped entirely.
TLS_SKIP_PATTERNS = {
    "china.org.cn", "xinhuanet.com", "chinadaily.com.cn", "people.com.cn",
    "globaltimes.cn", "cctv.com", "cgtn.com", "chinanews.com.cn",
    "rt.com", "sputniknews.com", "tass.com", "ria.ru",
    "presstv.ir", "presstv.com", "khamenei.ir",
    "almayadeen.net",
}

TOR_PROXY = "socks5://127.0.0.1:9050"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


def make_client(use_tor: bool = True, timeout: float = 30.0) -> httpx.Client:
    """Return an httpx client, preferring Tor when available."""
    # Use explicit connect+read timeouts to prevent half-open TCP stalls.
    # Some hosts (china.org.cn, state-run media) accept the connection but
    # trickle data — a plain float timeout only covers connect, not read.
    strict_timeout = httpx.Timeout(
        connect=min(timeout, 6.0),
        read=min(timeout, 8.0),
        write=min(timeout, 6.0),
        pool=min(timeout, 6.0),
    )
    kwargs = dict(
        timeout=strict_timeout,
        follow_redirects=True,
        verify=False,
        headers=HEADERS,
    )
    if use_tor:
        try:
            test = httpx.get(
                "http://check.torproject.org/api/ip",
                proxy=TOR_PROXY,
                timeout=8,
                verify=False,
            )
            if test.status_code == 200:
                kwargs["proxy"] = TOR_PROXY
                log.info("Tor SOCKS5 active — routing through localhost:9050")
            else:
                log.warning("Tor check returned %s — using direct", test.status_code)
        except Exception as e:
            log.warning("Tor unavailable (%s) — falling back to direct", e)
    return httpx.Client(**kwargs)


# ---------------------------------------------------------------------------
# MBFC category → our category mapping
# ---------------------------------------------------------------------------
MBFC_CATEGORIES = {
    "left": ["left-leaning"],
    "leftcenter": ["left-leaning"],
    "center": ["mainstream"],
    "right-center": ["right-leaning"],
    "right": ["right-leaning"],
    "pro-science": ["mainstream"],
    "fake-news": ["independent"],       # conspiracy/low-credibility bucket
    "satire": ["tabloid"],
}

# Regex to pull "(domain.com)" or "(www.domain.com/path)" from MBFC link text
DOMAIN_RE = re.compile(r"\(([^)]+)\)$")


def parse_mbfc_link_text(text: str) -> tuple[str, str]:
    """
    'BBC News (bbc.com)' -> ('BBC News', 'bbc.com')
    '350 Canada (350.org/canada/)' -> ('350 Canada', '350.org/canada/')
    Returns (name, raw_domain_or_path) or (text, '') on failure.
    """
    m = DOMAIN_RE.search(text.strip())
    if m:
        raw = m.group(1).strip()
        name = text[: m.start()].strip()
        return name, raw
    return text.strip(), ""


def normalise_url(raw: str) -> str:
    """
    'bbc.com' -> 'https://www.bbc.com'
    '350.org/canada/' -> 'https://350.org/canada/'
    Already-schemed URLs are returned as-is.
    """
    raw = raw.strip().rstrip("/")
    if not raw:
        return ""
    if raw.startswith("http://") or raw.startswith("https://"):
        return raw
    # No scheme → prepend https
    return "https://" + raw


def domain_of(url: str) -> str:
    """Extract registrable domain (no www prefix) for dedup."""
    try:
        parsed = urlparse(url if "://" in url else "https://" + url)
        host = parsed.netloc or parsed.path.split("/")[0]
        return host.lower().lstrip("www.")
    except Exception:
        return url.lower()


# ---------------------------------------------------------------------------
# Existing sources — load once for dedup
# ---------------------------------------------------------------------------

def load_existing_domains() -> set[str]:
    """Return set of normalised domains already in sources_global.json."""
    domains: set[str] = set()
    if not SOURCES_GLOBAL.exists():
        log.warning("sources_global.json not found at %s", SOURCES_GLOBAL)
        return domains
    with open(SOURCES_GLOBAL) as f:
        data = json.load(f)
    for src in data.get("sources", []):
        url = src.get("url_home", "")
        if url:
            domains.add(domain_of(url))
    log.info("Loaded %d existing domains for dedup", len(domains))
    return domains


def load_discovered_domains() -> set[str]:
    """Return domains already written to sources_discovered.jsonl."""
    domains: set[str] = set()
    if not SOURCES_DISCOVERED.exists():
        return domains
    with open(SOURCES_DISCOVERED) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                src = json.loads(line)
                url = src.get("url_home", "")
                if url:
                    domains.add(domain_of(url))
            except json.JSONDecodeError:
                pass
    return domains


# ---------------------------------------------------------------------------
# RSS feed discovery
# ---------------------------------------------------------------------------

FEED_PATHS = [
    "/feed",
    "/rss",
    "/rss.xml",
    "/feed.xml",
    "/atom.xml",
    "/news.rss",
    "/?feed=rss2",
    "/feeds/posts/default",
    "/feed/rss2",
    "/rss/news.xml",
    "/index.rss",
    "/feeds/all.rss.xml",
    "/news/rss.xml",
]

ATOM_NS = "{http://www.w3.org/2005/Atom}"


def _is_valid_feed(content: bytes) -> bool:
    """Return True if content looks like RSS/Atom with at least 1 item."""
    try:
        root = ET.fromstring(content)
        tag = root.tag.lower()
        # Atom
        if "feed" in tag:
            entries = root.findall(f"{ATOM_NS}entry")
            return len(entries) >= 1
        # RSS
        items = root.findall(".//item")
        return len(items) >= 1
    except ET.ParseError:
        return False


def discover_feed(home_url: str, client: httpx.Client) -> tuple[str, str]:
    """
    Try to discover an RSS/Atom feed for home_url.
    Returns (feed_url, feed_type) or ('', '').

    Strategy:
    1. Parse <link> autodiscovery in homepage HTML.
    2. Try common path suffixes.
    """
    parsed = urlparse(home_url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    # Step 1 — autodiscovery from homepage HTML
    try:
        r = client.get(home_url)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            for link_tag in soup.find_all("link", type=True):
                lt = link_tag.get("type", "")
                href = link_tag.get("href", "")
                if ("rss" in lt or "atom" in lt) and href:
                    feed_url = urljoin(home_url, href)
                    feed_type = "atom" if "atom" in lt else "rss"
                    # Validate it
                    try:
                        fr = client.get(feed_url)
                        if fr.status_code == 200 and _is_valid_feed(fr.content):
                            return feed_url, feed_type
                    except Exception:
                        pass
    except Exception:
        pass

    # Step 2 — path probing
    for path in FEED_PATHS:
        url = base + path
        try:
            r = client.get(url)
            if r.status_code == 200 and len(r.content) > 300:
                ct = r.headers.get("content-type", "")
                looks_xml = "xml" in ct or "rss" in ct or "atom" in ct or r.text.strip().startswith("<")
                if looks_xml and _is_valid_feed(r.content):
                    feed_type = "atom" if "atom" in r.text[:200].lower() else "rss"
                    return url, feed_type
        except Exception:
            pass
        time.sleep(0.05)

    return "", ""


# ---------------------------------------------------------------------------
# Country detection (best-effort from domain TLD)
# ---------------------------------------------------------------------------

TLD_TO_COUNTRY = {
    "uk": "GB", "co.uk": "GB", "bbc.co.uk": "GB",
    "au": "AU", "ca": "CA", "de": "DE", "fr": "FR",
    "in": "IN", "jp": "JP", "nz": "NZ", "br": "BR",
    "mx": "MX", "es": "ES", "it": "IT", "nl": "NL",
    "se": "SE", "no": "NO", "dk": "DK", "fi": "FI",
    "za": "ZA", "ng": "NG", "ke": "KE", "eg": "EG",
    "ru": "RU", "cn": "CN", "kr": "KR", "sg": "SG",
    "ch": "CH", "at": "AT", "be": "BE", "pl": "PL",
    "tr": "TR", "il": "IL", "pk": "PK", "bd": "BD",
    "ar": "AR", "cl": "CL", "co": "CO", "pe": "PE",
    "pt": "PT", "gr": "GR", "cz": "CZ", "sk": "SK",
    "hu": "HU", "ro": "RO", "bg": "BG", "hr": "HR",
    "lv": "LV", "lt": "LT", "ee": "EE", "si": "SI",
    "ua": "UA", "by": "BY", "kz": "KZ", "uz": "UZ",
    "id": "ID", "my": "MY", "ph": "PH", "th": "TH",
    "vn": "VN", "hk": "HK", "tw": "TW", "io": "GB",
    "ie": "IE", "is": "IS", "lu": "LU", "mt": "MT",
    "cy": "CY", "mk": "MK", "rs": "RS", "ba": "BA",
    "me": "ME", "al": "AL", "md": "MD", "am": "AM",
    "ge": "GE", "az": "AZ",
}


def infer_country(url: str) -> str:
    """Best-effort country code from TLD."""
    try:
        host = urlparse(url).netloc.lower().lstrip("www.")
        parts = host.split(".")
        tld = parts[-1] if parts else ""
        # Check co.uk, com.au etc.
        if len(parts) >= 2:
            two = ".".join(parts[-2:])
            if two in TLD_TO_COUNTRY:
                return TLD_TO_COUNTRY[two]
        if tld in TLD_TO_COUNTRY:
            return TLD_TO_COUNTRY[tld]
        return "US"  # Default — most MBFC sources are US
    except Exception:
        return "US"


# ---------------------------------------------------------------------------
# ID generation
# ---------------------------------------------------------------------------

def make_id(name: str, url: str) -> str:
    """Generate a unique snake_case id from name."""
    base = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    base = re.sub(r"_+", "_", base)
    if not base:
        base = domain_of(url).replace(".", "_")
    return base[:60]


# ---------------------------------------------------------------------------
# MBFC scraper
# ---------------------------------------------------------------------------

def scrape_mbfc_category(
    category_slug: str,
    our_categories: list[str],
    client: httpx.Client,
) -> list[dict]:
    """
    Scrape one MBFC category page, return list of dicts:
    {name, url_home, raw_mbfc_url, categories}
    """
    url = f"https://mediabiasfactcheck.com/{category_slug}/"
    log.info("Scraping MBFC category: %s", url)
    try:
        r = client.get(url, timeout=30)
        if r.status_code != 200:
            log.warning("  HTTP %s for %s", r.status_code, url)
            return []
    except Exception as e:
        log.error("  Failed to fetch %s: %s", url, e)
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    content_div = soup.find("div", class_="entry-content") or soup.find("article")
    if not content_div:
        log.warning("  No content div found for %s", url)
        return []

    results = []
    links = [
        a for a in content_div.find_all("a", href=True)
        if "mediabiasfactcheck.com" in a.get("href", "")
        and a.get("href", "").startswith("https://mediabiasfactcheck.com/")
        and not any(skip in a.get("href", "") for skip in [
            "/left/", "/right/", "/center/", "/pro-science/",
            "/fake-news/", "/satire/", "/conspiracy/",
            "/category/", "/about", "/contact", "/support",
        ])
    ]

    for a in links:
        text = a.get_text(strip=True)
        name, raw_domain = parse_mbfc_link_text(text)
        if not name or not raw_domain:
            continue
        home_url = normalise_url(raw_domain)
        if not home_url:
            continue
        results.append({
            "name": name,
            "url_home": home_url,
            "raw_mbfc_url": a.get("href", ""),
            "categories": our_categories,
        })

    log.info("  Found %d candidate sources in %s", len(results), category_slug)
    return results


def run_mbfc_discovery(
    limit: int,
    existing_domains: set[str],
    discovered_domains: set[str],
    client: httpx.Client,
    feed_client: httpx.Client,
) -> list[dict]:
    """
    Drive the full MBFC scrape across all categories.
    Writes each validated entry immediately to sources_discovered.jsonl (incremental).
    Returns list of all validated entries for summary display.
    """
    all_candidates: list[dict] = []

    for slug, our_cats in MBFC_CATEGORIES.items():
        cats_data = scrape_mbfc_category(slug, our_cats, client)
        all_candidates.extend(cats_data)
        time.sleep(0.5)  # be polite to MBFC

    log.info("Total raw candidates from MBFC: %d", len(all_candidates))

    # Deduplicate candidates against each other (same domain from multiple categories)
    seen_in_batch: set[str] = set()
    unique_candidates: list[dict] = []
    for c in all_candidates:
        d = domain_of(c["url_home"])
        if d not in seen_in_batch:
            seen_in_batch.add(d)
            unique_candidates.append(c)

    log.info("Unique candidates after batch dedup: %d", len(unique_candidates))

    # Ensure output file directory exists
    SOURCES_DISCOVERED.parent.mkdir(parents=True, exist_ok=True)

    validated: list[dict] = []
    skipped_existing = 0
    skipped_no_feed = 0

    for candidate in unique_candidates:
        if len(validated) >= limit:
            log.info("Hit limit of %d — stopping", limit)
            break

        home_url = candidate["url_home"]
        d = domain_of(home_url)

        # Dedup against existing sources
        if d in existing_domains or d in discovered_domains:
            skipped_existing += 1
            continue

        # Skip TLS-stalling domains (state-run / geo-blocked that hang TLS handshake)
        d_check = domain_of(home_url)
        if any(skip in d_check for skip in TLS_SKIP_PATTERNS):
            log.debug("  Skipping TLS-stall domain: %s", home_url)
            # Still include without a feed so it appears in the output
            feed_url, feed_type = "", "html"
            fetch_method = "stealth"
            source_id = make_id(candidate["name"], home_url)
            country = infer_country(home_url)
            entry = {
                "id": source_id,
                "name": candidate["name"],
                "country": country,
                "language": "en",
                "url_home": home_url,
                "feed_url": home_url,
                "feed_type": feed_type,
                "fetch_method": fetch_method,
                "categories": candidate["categories"],
                "mbfc_url": candidate.get("raw_mbfc_url", ""),
            }
            with open(SOURCES_DISCOVERED, "a") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            validated.append(entry)
            discovered_domains.add(d)
            continue

        log.info("[%d/%d] Probing: %s", len(validated) + 1, limit, home_url)

        # RSS feed discovery — hard 25s wall-clock cap using daemon thread
        # (covers SSL handshake stalls that httpx.Timeout cannot reach)
        try:
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            future = executor.submit(discover_feed, home_url, feed_client)
            executor.shutdown(wait=False)   # don't block main thread on thread exit
            try:
                feed_url, feed_type = future.result(timeout=25)
            except concurrent.futures.TimeoutError:
                log.debug("  Feed discovery wall-clock timeout for %s", home_url)
                feed_url, feed_type = "", ""
        except Exception as e:
            log.debug("  Feed discovery error for %s: %s", home_url, e)
            feed_url, feed_type = "", ""

        if not feed_url:
            skipped_no_feed += 1
            log.debug("  No feed found for %s", home_url)
            # Still include sources without feeds — mark fetch_method as stealth
            # to indicate they need JS fetching, but don't discard them
            fetch_method = "stealth"
            feed_type = "html"
        else:
            fetch_method = "direct"
            log.info("  Feed: %s (%s)", feed_url, feed_type)

        # Build entry
        source_id = make_id(candidate["name"], home_url)
        country = infer_country(home_url)

        entry = {
            "id": source_id,
            "name": candidate["name"],
            "country": country,
            "language": "en",
            "url_home": home_url,
            "feed_url": feed_url or home_url,
            "feed_type": feed_type,
            "fetch_method": fetch_method,
            "categories": candidate["categories"],
            "mbfc_url": candidate.get("raw_mbfc_url", ""),
        }

        # Write incrementally — don't lose work on crash/kill
        with open(SOURCES_DISCOVERED, "a") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        validated.append(entry)
        discovered_domains.add(d)  # prevent dupes within this run

        time.sleep(0.3)

    log.info(
        "Discovery complete. Validated: %d | Skipped (existing): %d | Skipped (no feed): %d",
        len(validated),
        skipped_existing,
        skipped_no_feed,
    )
    return validated


# ---------------------------------------------------------------------------
# Write output
# ---------------------------------------------------------------------------

def write_discovered(entries: list[dict]) -> int:
    """Append entries to sources_discovered.jsonl. Returns count written."""
    SOURCES_DISCOVERED.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with open(SOURCES_DISCOVERED, "a") as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            written += 1
    return written


# ---------------------------------------------------------------------------
# Wikipedia newspaper list scraper
# ---------------------------------------------------------------------------

# Wikipedia lists newspapers by country — this page has anchor links to sections
WIKIPEDIA_NEWSPAPER_URL = "https://en.wikipedia.org/wiki/List_of_newspapers_by_country"

# Map of Wikipedia country section names → ISO codes (expand as needed)
WIKI_COUNTRY_MAP: dict[str, str] = {
    "Afghanistan": "AF", "Albania": "AL", "Algeria": "DZ", "Angola": "AO",
    "Argentina": "AR", "Armenia": "AM", "Australia": "AU", "Austria": "AT",
    "Azerbaijan": "AZ", "Bahrain": "BH", "Bangladesh": "BD", "Belarus": "BY",
    "Belgium": "BE", "Bolivia": "BO", "Bosnia and Herzegovina": "BA",
    "Brazil": "BR", "Bulgaria": "BG", "Cambodia": "KH", "Cameroon": "CM",
    "Canada": "CA", "Chile": "CL", "China": "CN", "Colombia": "CO",
    "Croatia": "HR", "Cuba": "CU", "Czech Republic": "CZ", "Denmark": "DK",
    "Ecuador": "EC", "Egypt": "EG", "Estonia": "EE", "Ethiopia": "ET",
    "Finland": "FI", "France": "FR", "Georgia": "GE", "Germany": "DE",
    "Ghana": "GH", "Greece": "GR", "Guatemala": "GT", "Honduras": "HN",
    "Hong Kong": "HK", "Hungary": "HU", "Iceland": "IS", "India": "IN",
    "Indonesia": "ID", "Iran": "IR", "Iraq": "IQ", "Ireland": "IE",
    "Israel": "IL", "Italy": "IT", "Jamaica": "JM", "Japan": "JP",
    "Jordan": "JO", "Kazakhstan": "KZ", "Kenya": "KE", "Kosovo": "XK",
    "Kuwait": "KW", "Kyrgyzstan": "KG", "Latvia": "LV", "Lebanon": "LB",
    "Libya": "LY", "Lithuania": "LT", "Luxembourg": "LU", "Malaysia": "MY",
    "Mexico": "MX", "Moldova": "MD", "Montenegro": "ME", "Morocco": "MA",
    "Mozambique": "MZ", "Myanmar": "MM", "Nepal": "NP", "Netherlands": "NL",
    "New Zealand": "NZ", "Nicaragua": "NI", "Nigeria": "NG", "North Macedonia": "MK",
    "Norway": "NO", "Oman": "OM", "Pakistan": "PK", "Panama": "PA",
    "Paraguay": "PY", "Peru": "PE", "Philippines": "PH", "Poland": "PL",
    "Portugal": "PT", "Qatar": "QA", "Romania": "RO", "Russia": "RU",
    "Rwanda": "RW", "Saudi Arabia": "SA", "Senegal": "SN", "Serbia": "RS",
    "Singapore": "SG", "Slovakia": "SK", "Slovenia": "SI", "Somalia": "SO",
    "South Africa": "ZA", "South Korea": "KR", "Spain": "ES", "Sri Lanka": "LK",
    "Sudan": "SD", "Sweden": "SE", "Switzerland": "CH", "Syria": "SY",
    "Taiwan": "TW", "Tajikistan": "TJ", "Tanzania": "TZ", "Thailand": "TH",
    "Trinidad and Tobago": "TT", "Tunisia": "TN", "Turkey": "TR",
    "Uganda": "UG", "Ukraine": "UA", "United Arab Emirates": "AE",
    "United Kingdom": "GB", "United States": "US", "Uruguay": "UY",
    "Uzbekistan": "UZ", "Venezuela": "VE", "Vietnam": "VN", "Yemen": "YE",
    "Zambia": "ZM", "Zimbabwe": "ZW",
}


def _extract_external_urls(td) -> list[str]:
    """Extract external HTTP/S URLs from a table cell."""
    urls = []
    for a in td.find_all("a", href=True):
        href = a["href"]
        if href.startswith("http://") or href.startswith("https://"):
            if "wikipedia.org" not in href and "wikimedia.org" not in href:
                urls.append(href)
    return urls


def scrape_wikipedia_newspapers(
    limit: int,
    existing_domains: set[str],
    discovered_domains: set[str],
    client: httpx.Client,
    feed_client: httpx.Client,
) -> list[dict]:
    """
    Fetch https://en.wikipedia.org/wiki/List_of_newspapers_by_country,
    extract newspaper entries with homepage URLs, probe for RSS feeds,
    write validated entries to sources_discovered.jsonl incrementally.
    """
    log.info("Fetching Wikipedia newspaper list: %s", WIKIPEDIA_NEWSPAPER_URL)
    try:
        r = client.get(WIKIPEDIA_NEWSPAPER_URL, timeout=30)
        if r.status_code != 200:
            log.error("Wikipedia fetch failed: HTTP %s", r.status_code)
            return []
    except Exception as e:
        log.error("Wikipedia fetch error: %s", e)
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    content = soup.find("div", id="mw-content-text") or soup.find("div", class_="mw-parser-output")
    if not content:
        log.error("Wikipedia: could not find main content div")
        return []

    # Walk h2/h3 headings to track current country, then grab all external
    # links inside the subsequent lists/tables until the next heading.
    candidates: list[dict] = []
    current_country_name = "Unknown"
    current_country_code = "US"

    for elem in content.children:
        if not hasattr(elem, "name") or not elem.name:
            continue

        if elem.name in ("h2", "h3"):
            # Extract heading text — strip [edit] spans
            heading_text = elem.get_text(strip=True).replace("[edit]", "").strip()
            if heading_text in WIKI_COUNTRY_MAP:
                current_country_name = heading_text
                current_country_code = WIKI_COUNTRY_MAP[heading_text]
            else:
                # Reset if heading is not a known country (Contents, References, etc.)
                pass
            continue

        if elem.name in ("ul", "ol", "table", "div"):
            # Extract any external URLs in this block
            for a in elem.find_all("a", href=True):
                href = a["href"]
                if not (href.startswith("http://") or href.startswith("https://")):
                    continue
                if "wikipedia.org" in href or "wikimedia.org" in href:
                    continue
                name = a.get_text(strip=True)
                if not name or len(name) < 2:
                    continue
                candidates.append({
                    "name": name,
                    "url_home": href.rstrip("/"),
                    "country": current_country_code,
                    "country_name": current_country_name,
                    "categories": ["mainstream"],
                })

    log.info("Wikipedia: extracted %d raw candidates", len(candidates))

    # Deduplicate candidates against each other
    seen_in_batch: set[str] = set()
    unique_candidates: list[dict] = []
    for c in candidates:
        d = domain_of(c["url_home"])
        if d not in seen_in_batch:
            seen_in_batch.add(d)
            unique_candidates.append(c)
    log.info("Wikipedia: %d unique candidates after dedup", len(unique_candidates))

    SOURCES_DISCOVERED.parent.mkdir(parents=True, exist_ok=True)

    validated: list[dict] = []
    skipped_existing = 0
    skipped_no_feed = 0

    for candidate in unique_candidates:
        if len(validated) >= limit:
            log.info("Hit limit of %d — stopping", limit)
            break

        home_url = candidate["url_home"]
        d = domain_of(home_url)

        if d in existing_domains or d in discovered_domains:
            skipped_existing += 1
            continue

        # Skip TLS-stalling domains
        if any(skip in d for skip in TLS_SKIP_PATTERNS):
            log.debug("  Skipping TLS-stall domain: %s", home_url)
            fetch_method = "stealth"
            feed_type = "html"
            source_id = make_id(candidate["name"], home_url)
            entry = {
                "id": source_id,
                "name": candidate["name"],
                "country": candidate["country"],
                "language": "en",
                "url_home": home_url,
                "feed_url": home_url,
                "feed_type": feed_type,
                "fetch_method": fetch_method,
                "categories": candidate["categories"],
                "source": "wikipedia",
            }
            with open(SOURCES_DISCOVERED, "a") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            validated.append(entry)
            discovered_domains.add(d)
            continue

        log.info("[%d/%d] Probing (wiki): %s", len(validated) + 1, limit, home_url)

        # Feed discovery with 25s wall-clock cap
        try:
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            future = executor.submit(discover_feed, home_url, feed_client)
            executor.shutdown(wait=False)
            try:
                feed_url, feed_type = future.result(timeout=25)
            except concurrent.futures.TimeoutError:
                log.debug("  Feed discovery wall-clock timeout for %s", home_url)
                feed_url, feed_type = "", ""
        except Exception as e:
            log.debug("  Feed discovery error for %s: %s", home_url, e)
            feed_url, feed_type = "", ""

        if not feed_url:
            skipped_no_feed += 1
            fetch_method = "stealth"
            feed_type = "html"
        else:
            fetch_method = "direct"
            log.info("  Feed: %s (%s)", feed_url, feed_type)

        source_id = make_id(candidate["name"], home_url)
        entry = {
            "id": source_id,
            "name": candidate["name"],
            "country": candidate["country"],
            "language": "en",
            "url_home": home_url,
            "feed_url": feed_url or home_url,
            "feed_type": feed_type,
            "fetch_method": fetch_method,
            "categories": candidate["categories"],
            "source": "wikipedia",
        }

        with open(SOURCES_DISCOVERED, "a") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        validated.append(entry)
        discovered_domains.add(d)
        time.sleep(0.3)

    log.info(
        "Wikipedia discovery complete. Validated: %d | Skipped (existing): %d | No feed: %d",
        len(validated),
        skipped_existing,
        skipped_no_feed,
    )
    return validated


# ---------------------------------------------------------------------------
# Status command
# ---------------------------------------------------------------------------

def cmd_status() -> None:
    existing = 0
    if SOURCES_GLOBAL.exists():
        with open(SOURCES_GLOBAL) as f:
            data = json.load(f)
        existing = len(data.get("sources", []))

    discovered = 0
    if SOURCES_DISCOVERED.exists():
        with open(SOURCES_DISCOVERED) as f:
            for line in f:
                if line.strip():
                    discovered += 1

    total = existing + discovered
    print(f"sources_global.json   : {existing:>6} sources")
    print(f"sources_discovered.jsonl: {discovered:>4} sources")
    print(f"Combined total        : {total:>6} sources")
    print(f"Target                : 10,000 sources")
    print(f"Gap                   : {10000 - total:>6} sources remaining")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="BOTWAVEBOMBA source discovery — MBFC scraper + RSS validator"
    )
    parser.add_argument(
        "--mbfc",
        action="store_true",
        help="Scrape Media Bias/Fact Check for new sources",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=200,
        help="Max new validated sources to discover (default: 200)",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Show current source counts",
    )
    parser.add_argument(
        "--wikipedia",
        action="store_true",
        help="Scrape Wikipedia List of newspapers by country",
    )
    parser.add_argument(
        "--no-tor",
        action="store_true",
        help="Skip Tor proxy even if available",
    )
    args = parser.parse_args()

    if args.status:
        cmd_status()
        return

    use_tor = not args.no_tor
    main_client = make_client(use_tor=use_tor, timeout=35)
    feed_client = make_client(use_tor=False, timeout=8)
    existing_domains = load_existing_domains()
    discovered_domains = load_discovered_domains()

    if args.mbfc:
        entries = run_mbfc_discovery(
            limit=args.limit,
            existing_domains=existing_domains,
            discovered_domains=discovered_domains,
            client=main_client,
            feed_client=feed_client,
        )

        if not entries:
            log.warning("No new sources discovered.")
        else:
            log.info("Wrote %d entries to %s (incremental)", len(entries), SOURCES_DISCOVERED)
            print("\n--- Top 10 discovered sources (MBFC) ---")
            for i, e in enumerate(entries[:10], 1):
                print(f"{i:>2}. {e['name'][:40]:<40} | {e['country']} | {e['feed_type']:<4} | {e['url_home']}")
            print(f"\nTotal new sources written: {len(entries)}")
            cmd_status()
        return

    if args.wikipedia:
        entries = scrape_wikipedia_newspapers(
            limit=args.limit,
            existing_domains=existing_domains,
            discovered_domains=discovered_domains,
            client=main_client,
            feed_client=feed_client,
        )

        if not entries:
            log.warning("No new Wikipedia sources discovered.")
        else:
            log.info("Wrote %d entries to %s (incremental)", len(entries), SOURCES_DISCOVERED)
            print("\n--- Top 10 discovered sources (Wikipedia) ---")
            for i, e in enumerate(entries[:10], 1):
                print(f"{i:>2}. {e['name'][:40]:<40} | {e['country']} | {e['feed_type']:<4} | {e['url_home']}")
            print(f"\nTotal new sources written: {len(entries)}")
            cmd_status()
        return

    parser.print_help()


if __name__ == "__main__":
    main()
