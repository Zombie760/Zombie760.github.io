#!/usr/bin/env python3
"""
BOTWAVEBOMBA feed generator v3 — multi-entity pair clustering
Target: 100 multi-source stories from 2,651 article cache
"""
import json
import re
import hashlib
import math
from collections import defaultdict
from itertools import combinations
from pathlib import Path
from datetime import datetime, timezone

# Boilerplate signals — if any appear in the first 120 chars, full_text is junk
_BOILERPLATE_STARTS = [
    'Watch Live', 'Home News Sport', 'Skip to content',
    'در حال انتقال',   # IRNA Farsi redirect
    'JavaScript', '@property', '--tw-', 'inherits:false',
    'syntax:"', 'initial-value',
]
_HTML_TAG_RE = re.compile(r'<[a-zA-Z/][^>]{0,40}>')

def _clean(text):
    """Strip HTML tags and collapse whitespace."""
    text = _HTML_TAG_RE.sub(' ', text)
    return re.sub(r'\s+', ' ', text).strip()

def get_snippet(art, max_chars=300):
    """Return the best available lede text for an article, truncated cleanly."""
    ft   = _clean((art.get('full_text')   or ''))
    desc = _clean((art.get('description') or ''))

    # Use full_text only if it's long enough and free of boilerplate signals
    ft_ok = len(ft) > 150 and not any(pat in ft[:120] for pat in _BOILERPLATE_STARTS)
    text = ft if ft_ok else (desc if len(desc) > 50 else ft or desc)

    if not text:
        return ''
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars]
    last_space = cut.rfind(' ')
    return (cut[:last_space] if last_space > 100 else cut) + '…'

CACHE        = Path('/var/home/gringo/Botwave-Master/book_arm/memory/news_cache.jsonl')
FINGERPRINTS = Path('/var/home/gringo/Botwave-Master/book_arm/memory/source_fingerprints.json')
SOURCES_GLOBAL = Path('/var/home/gringo/Botwave-Master/book_arm/memory/sources_global.json')
OUTPUT = Path('/var/home/gringo/Botwave-Master/zombie760.github.io/botwavebomba/api/latest.json')

# Ground News blindspot thresholds (from recon 2026-05-09)
BLINDSPOT_MIN_PCT   = 17   # one side below this → blindspot candidate
BLINDSPOT_OTHER_MIN = 33   # other side must be at least this high

# Western Mono-Frame / Blackout thresholds
MONO_FRAME_WEST_THRESHOLD = 75   # west_pct >= this + 0 regional sources → Mono-Frame
BLACKOUT_WEST_THRESHOLD   = 10   # west_pct <= this + 2+ non-western → Blackout

# Geopolitical watchlists — entity keywords that trigger geo-frame analysis
# Matched against extracted proper nouns in cluster headlines
MONO_FRAME_WATCHLISTS = {
    'middle-east': {
        'entities': {
            'Gaza', 'Palestinian', 'Palestinians', 'Netanyahu', 'Hamas', 'Hezbollah',
            'Lebanon', 'Lebanese', 'Rafah', 'Settler', 'Settlers', 'Israel', 'Israeli',
            'Israelis', 'Palestine', 'Occupied', 'Airstrike', 'Airstrikes', 'Blockade',
            'Genocide', 'Flotilla', 'Apartheid', 'Intifada', 'Houthi', 'Houthis',
            'Yemen', 'Yemeni', 'Syria', 'Syrian', 'Idlib', 'Baghdad', 'Iraqi',
            'Beirut', 'Hizbollah', 'Sabra', 'Shatila', 'Jenin', 'Nablus',
        },
        'regional_cluster': 'middle-east',
        'label': 'Middle East',
    },
    'cartel-intel': {
        'entities': {
            'Cartel', 'Sinaloa', 'CJNG', 'Jalisco', 'Narco', 'Narcos', 'Narcotrafficking',
            'Rendition', 'Guantanamo', 'Fentanyl', 'Trafficking', 'Cocaine',
            'Contras', 'Paramilitary', 'Paramilitaries', 'Extradition',
        },
        'regional_cluster': 'latin-america',
        'label': 'Cartel / Intelligence Ops',
    },
    'us-foreign-policy': {
        'entities': {
            'Sanctions', 'Venezuela', 'Cuba', 'Nicaragua', 'Bolivia', 'Maduro',
            'Tehran', 'Iranian', 'Ayatollah', 'Khamenei', 'Destabilization',
            'Coup', 'Regime', 'Embargo', 'USAID', 'Covert',
        },
        'regional_cluster': None,
        'label': 'US Foreign Policy Target',
    },
    'africa-suppressed': {
        'entities': {
            'Somalia', 'Somali', 'Sudan', 'Sudanese', 'Ethiopia', 'Ethiopian',
            'Congo', 'Congolese', 'Mali', 'Niger', 'Sahel', 'Junta', 'Wagner',
            'AFRICOM', 'Militia', 'Massacre',
        },
        'regional_cluster': 'africa',
        'label': 'Africa (Under-Reported)',
    },
}

TARGET_STORIES = 160   # more stories to fill multiple sections
MIN_ARTICLES   = 3
MIN_SOURCES    = 2

# ── NEWSPAPER SECTION CLASSIFIER ──────────────────────────────────────────────
# Source-level section tags (strongest signal — overrides keywords)
SECTION_SOURCE_TAGS = {
    # Sports
    'bbc_sport': 'sports', 'espn': 'sports', 'sky_sports': 'sports',
    'marca': 'sports', 'goal': 'sports', 'bleacher_report': 'sports',
    'the_athletic': 'sports', 'lequipe': 'sports', 'sport_bible': 'sports',
    # Entertainment
    'variety': 'entertainment', 'hollywood_reporter': 'entertainment',
    'deadline': 'entertainment', 'billboard': 'entertainment',
    'pitchfork': 'entertainment', 'rolling_stone': 'entertainment',
    'consequence_of_sound': 'entertainment',
    # Chisme (tabloid gossip)
    'tmz': 'chisme', 'pagesix': 'chisme', 'people_mag': 'chisme',
    'daily_mail_ent': 'chisme', 'the_sun_showbiz': 'chisme',
    'radar_online': 'chisme', 'us_weekly': 'chisme',
    # Funnies / Satire
    'the_onion': 'funnies', 'daily_mash': 'funnies', 'babylon_bee': 'funnies',
    'the_beaverton': 'funnies', 'the_shovel': 'funnies',
    'waterford_whispers': 'funnies', 'daily_squib': 'funnies',
}

# Source IDs that are tabloid-tier (used for chisme_score calculation)
TABLOID_SOURCES = {
    'daily_mail', 'the_sun', 'daily_mirror', 'new_york_post', 'tmz',
    'pagesix', 'people_mag', 'daily_mail_ent', 'the_sun_showbiz',
    'radar_online', 'us_weekly', 'daily_star', 'national_enquirer',
    'ok_magazine', 'heat_magazine', 'closer_magazine',
}

# Keyword sets for each section (checked against lowercased headline text)
SECTION_KEYWORDS = {
    'sports': {
        'nba', 'nfl', 'nhl', 'mlb', 'fifa', 'uefa', 'premier league', 'la liga',
        'serie a', 'bundesliga', 'champions league', 'world cup', 'super bowl',
        'wimbledon', 'olympic', 'formula 1', ' f1 ', 'grand prix', 'transfer',
        'playoff', 'championship', 'tournament', 'match', 'game', 'season',
        'goal', 'touchdown', 'innings', 'wicket', 'tennis', 'golf', 'boxing',
        'ufc', 'mma', 'wrestling', 'rugby', 'cricket', 'baseball', 'basketball',
        'football', 'soccer', 'athlete', 'coach', 'roster', 'draft', 'trade',
        'injury', 'suspended', 'banned', 'doping', 'stadium', 'score',
    },
    'entertainment': {
        'oscar', 'grammy', 'emmy', 'golden globe', 'bafta', 'cannes', 'sundance',
        'netflix', 'disney', 'hbo', 'amazon prime', 'apple tv', 'hulu',
        'marvel', 'box office', 'premiere', 'trailer', 'sequel', 'reboot',
        'album', 'single', 'tour', 'concert', 'festival', 'coachella',
        'billboard', 'grammy', 'streaming', 'spotify', 'youtube',
        'director', 'starring', 'cast', 'film festival', 'season finale',
        'showrunner', 'limited series', 'documentary',
    },
    'chisme': {
        'celebrity', 'cheating', 'affair', 'divorce', 'breakup', 'engaged',
        'wedding', 'pregnant', 'baby', 'scandal', 'feud', 'drama', 'beef',
        'rumor', 'spotted', 'dating', 'relationship', 'split up', 'loved up',
        'red carpet', 'paparazzi', 'instagram', 'tiktok', 'viral', 'clap back',
        'shaded', 'throwback', 'sources say', 'insider reveals',
    },
    'business': {
        'market', 'stock', 'trade', 'economy', 'gdp', 'inflation', 'tariff',
        'federal reserve', 'interest rate', 'wall street', 'nasdaq', 's&p',
        'earnings', 'revenue', 'profit', 'merger', 'acquisition', 'ipo',
        'layoffs', 'bankruptcy', 'debt', 'bond', 'recession', 'treasury',
        'imf', 'world bank', 'export', 'import', 'supply chain', 'dollar',
        'euro', 'bitcoin', 'crypto', 'defi', 'investment',
    },
    'tech': {
        'artificial intelligence', ' ai ', 'chatgpt', 'openai', 'llm',
        'nvidia', 'semiconductor', 'chip', 'cybersecurity', 'data breach',
        'hack', 'ransomware', 'silicon valley', 'startup', 'app', 'software',
        'hardware', 'robot', 'drone', 'satellite', 'space', 'launch',
        'microsoft', 'google', 'apple', 'meta', 'amazon', 'tesla', 'spacex',
        'antitrust', 'algorithm', 'privacy', 'surveillance', 'quantum',
    },
    'health': {
        'health', 'hospital', 'vaccine', 'virus', 'pandemic', 'cancer',
        'diabetes', 'mental health', 'therapy', 'depression', 'anxiety',
        'fda', 'drug', 'treatment', 'clinical trial', 'surgery', 'obesity',
        'nutrition', 'fitness', 'diet', 'aging', 'dementia', 'alzheimer',
        'heart disease', 'stroke', 'blood pressure', 'insurance', 'medicare',
        'medicaid', 'opioid', 'overdose', 'addiction',
    },
    'climate': {
        'climate change', 'global warming', 'carbon', 'emission', 'renewable',
        'solar', 'wind energy', 'fossil fuel', 'wildfire', 'drought', 'flood',
        'hurricane', 'typhoon', 'glacier', 'sea level', 'biodiversity',
        'species', 'deforestation', 'pollution', 'plastic', 'epa', 'cop30',
        'paris agreement', 'net zero', 'green deal',
    },
    'funnies': {
        'satirical', 'satire', 'parody', 'spoof', 'comedy news',
        'not real news', 'the onion', 'babylon bee',
    },
}

# Section display order (newspaper fold)
SECTION_ORDER = [
    'front-page', 'world', 'politics', 'conflict',
    'business', 'tech', 'health', 'climate',
    'sports', 'entertainment', 'chisme', 'funnies',
]


def classify_story(source_objects: list, headline: str) -> str:
    """
    Classify a story into a newspaper section.
    Priority: source-tag (strongest) → tabloid-majority (chisme) → keyword match → fallback
    """
    text = headline.lower()
    src_ids = [s.get('id', '') for s in source_objects]

    # 1. Source-tag: if majority of sources have a section tag, use it
    tagged = [SECTION_SOURCE_TAGS[sid] for sid in src_ids if sid in SECTION_SOURCE_TAGS]
    if tagged:
        from collections import Counter as _C
        top = _C(tagged).most_common(1)[0][0]
        return top

    # 2. Chisme score: if >50% of sources are tabloid-tier, it's chisme
    tabloid_count = sum(1 for sid in src_ids if sid in TABLOID_SOURCES)
    if len(src_ids) > 0 and tabloid_count / len(src_ids) >= 0.5:
        return 'chisme'

    # 3. Keyword match — ordered by specificity
    section_scores = {}
    for section, keywords in SECTION_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            section_scores[section] = score

    if section_scores:
        return max(section_scores, key=section_scores.get)

    return 'world'   # default for international news with no other match

STOP_WORDS = {
    'the','a','an','in','on','at','to','for','of','and','or','but','with',
    'from','by','as','is','was','are','were','be','been','its','it','this',
    'that','have','has','had','will','would','could','should','may','might',
    'says','said','after','before','over','under','into','about','new','more',
    'than','been','also','says','amid','amid','amid','amid','him','her','his',
    'they','their','them','we','our','us','you','your','he','she','who','what',
    'when','where','how','why','which','all','some','most','other','between',
    'during','against','without','through','while','since','still','up','down',
    'out','off','just','not','no','first','last','two','three','four','five',
    'report','reports','data','says','say','billion','million','thousand','day',
    'week','month','year','time','world','global','international','national',
}

# Generic common nouns that produce clickbait-heavy clusters — filtered out
GENERIC_ENTITIES = {
    'Billionaire', 'Expert', 'Report', 'Study', 'Official', 'Police',
    'Court', 'Judge', 'Minister', 'President', 'Prime', 'Chief',
    'Director', 'Secretary', 'Senator', 'Governor', 'Leader', 'Official',
    'Lawmakers', 'Officials', 'Experts', 'Scientists', 'Researchers',
    'Analysts', 'Sources', 'Reports', 'Claims', 'According', 'Democrats',
    'Republicans', 'Officials', 'Activist', 'Activists', 'Protesters',
}


def load_fingerprints():
    try:
        raw = json.loads(FINGERPRINTS.read_text())
        return raw.get('fingerprints', raw)
    except Exception:
        return {}


def load_source_bias():
    """Return dict of source_id → {bias_tier, bias_bucket, geo_cluster}."""
    try:
        raw = json.loads(SOURCES_GLOBAL.read_text())
        return {
            s['id']: {
                'bias_tier':   s.get('bias_tier', 'unknown'),
                'bias_bucket': s.get('bias_bucket', 'center'),
                'geo_cluster': s.get('geo_cluster', 'global-south'),
            }
            for s in raw.get('sources', [])
        }
    except Exception:
        return {}


def compute_coverage(source_ids: list, bias_map: dict) -> dict:
    """
    Given a list of source IDs for a story cluster, return left/center/right
    coverage percentages and blindspot flags — Ground News formula.
    """
    buckets = {'left': 0, 'center': 0, 'right': 0, 'state': 0}
    for sid in source_ids:
        bm = bias_map.get(sid, {})
        bucket = bm.get('bias_bucket', 'center')
        tier = bm.get('bias_tier', 'unknown')
        if tier == 'state-pro':
            buckets['state'] += 1
        else:
            buckets[bucket] += 1

    total = buckets['left'] + buckets['center'] + buckets['right']
    if total == 0:
        return {
            'left_pct': 0, 'center_pct': 0, 'right_pct': 0, 'state_count': buckets['state'],
            'is_blindspot': False, 'blindspot_side': None, 'dominant_bucket': 'center', 'dominant_pct': 0,
        }

    lp = round(buckets['left']   / total * 100)
    cp = round(buckets['center'] / total * 100)
    rp = round(buckets['right']  / total * 100)

    # Ground News blindspot formula: one side < 17% AND other side >= 33%
    blindspot_side = None
    if lp < BLINDSPOT_MIN_PCT and rp >= BLINDSPOT_OTHER_MIN:
        blindspot_side = 'left'   # story under-covered by left
    elif rp < BLINDSPOT_MIN_PCT and lp >= BLINDSPOT_OTHER_MIN:
        blindspot_side = 'right'  # story under-covered by right
    elif lp == 0 and rp == 0:
        blindspot_side = 'all'    # only center/state — no partisan coverage

    dominant = max(('left', lp), ('center', cp), ('right', rp), key=lambda x: x[1])[0]

    return {
        'left_pct':       lp,
        'center_pct':     cp,
        'right_pct':      rp,
        'state_count':    buckets['state'],
        'is_blindspot':   blindspot_side is not None,
        'blindspot_side': blindspot_side,
        'dominant_bucket': dominant,
        'dominant_pct':   max(lp, cp, rp),
    }


def compute_geo_frame(source_objects: list, entity_set: set) -> dict:
    """
    Detect Western Mono-Frame and Western Blackout for geopolitically sensitive topics.

    Mono-Frame: West covers ≥75% of the story AND the relevant regional press is absent.
    Blackout:   Western press covers ≤10% AND non-western sources tell the story.

    Returns geo_frame ('mono-frame'|'blackout'|None), geo_frame_label, geo_frame_topic,
    and geo_breakdown (raw source counts by cluster) — all verifiable by the reader.
    """
    geo_counts = defaultdict(int)
    for src in source_objects:
        geo_counts[src.get('geo_cluster', 'global-south')] += 1

    total = len(source_objects)
    if total == 0:
        return {'geo_frame': None, 'geo_frame_label': None,
                'geo_frame_topic': None, 'geo_breakdown': {}}

    west_count = geo_counts.get('west', 0)
    west_pct   = round(west_count / total * 100)

    # Find the first watchlist that matches an entity in this cluster
    matched_topic = None
    matched_meta  = None
    for topic, meta in MONO_FRAME_WATCHLISTS.items():
        if entity_set & meta['entities']:
            matched_topic = topic
            matched_meta  = meta
            break

    geo_breakdown = dict(geo_counts)

    if matched_topic is None:
        return {'geo_frame': None, 'geo_frame_label': None,
                'geo_frame_topic': None, 'geo_breakdown': geo_breakdown}

    regional_cluster = matched_meta['regional_cluster']
    regional_count   = geo_counts.get(regional_cluster, 0) if regional_cluster else 0
    topic_label      = matched_meta['label']

    # Mono-Frame: West dominates, regional press absent
    if west_pct >= MONO_FRAME_WEST_THRESHOLD and (regional_cluster is None or regional_count == 0):
        return {
            'geo_frame':       'mono-frame',
            'geo_frame_label': f'Western Mono-Frame: {topic_label}',
            'geo_frame_topic': matched_topic,
            'geo_breakdown':   geo_breakdown,
        }

    # Blackout: Western press absent, non-western speaks
    non_west = total - west_count
    if west_pct <= BLACKOUT_WEST_THRESHOLD and non_west >= 2:
        return {
            'geo_frame':       'blackout',
            'geo_frame_label': f'Western Blackout: {topic_label}',
            'geo_frame_topic': matched_topic,
            'geo_breakdown':   geo_breakdown,
        }

    return {'geo_frame': None, 'geo_frame_label': None,
            'geo_frame_topic': None, 'geo_breakdown': geo_breakdown}


def get_bloc(source_id, fps):
    fp = fps.get(source_id, {})
    axis = fp.get('axis', {})
    atlanticist = axis.get('atlanticist', None)
    if atlanticist is None:
        return 'neutral'
    # 0-1 scale: >=0.5 = western, <0.3 = adversarial
    if atlanticist >= 0.5:
        return 'western'
    if atlanticist < 0.3:
        return 'adversarial'
    return 'neutral'


def get_atlanticist_score(source_id, fps):
    fp = fps.get(source_id, {})
    axis = fp.get('axis', {})
    val = axis.get('atlanticist', None)
    if val is None:
        return None
    # Normalize to -10..+10 range for variance calculation
    return (val - 0.5) * 20


def extract_entities(headline, freq_filter=None):
    """Extract proper-noun entities from a headline.

    freq_filter: optional set of words that appear in >30% of all headlines.
    Those are too common to be meaningful cluster keys.
    Min length raised to 5 chars (4-char words like 'Iran' allowed via
    the original {3,} regex — we raise the body length to 4+ chars so
    the full token is 5+ chars).
    """
    words = re.findall(r'\b[A-Z][a-zA-Z]{4,}\b', headline)
    result = set()
    for w in words:
        if w.lower() in STOP_WORDS:
            continue
        if w in GENERIC_ENTITIES:
            continue
        if freq_filter and w in freq_filter:
            continue
        result.add(w)
    return result


def time_ago(ts_str):
    try:
        ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        diff = now - ts
        h = int(diff.total_seconds() / 3600)
        if h < 1:
            return 'just now'
        if h < 24:
            return f'{h}h ago'
        d = h // 24
        return f'{d}d ago'
    except Exception:
        return ''


def stdev(values):
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    return math.sqrt(variance)


def consensus_headline_art(arts):
    """Pick the article whose headline has maximum word overlap with the
    other headlines in the cluster. Words < 5 chars are excluded from
    scoring to avoid function-word noise.

    Returns the article dict with the highest consensus score.
    Falls back to median-length article if scoring is flat.
    """
    headlines = [a.get('headline', '') for a in arts]

    def meaningful_words(h):
        return {w.lower() for w in re.findall(r'\b[a-zA-Z]{5,}\b', h)
                if w.lower() not in STOP_WORDS}

    word_sets = [meaningful_words(h) for h in headlines]
    combined = set()
    for ws in word_sets:
        combined.update(ws)

    # Build a global frequency map across the cluster
    freq = defaultdict(int)
    for ws in word_sets:
        for w in ws:
            freq[w] += 1

    scores = []
    for i, art in enumerate(arts):
        ws = word_sets[i]
        # Score = sum of freq(w) for w in this headline's words
        # Higher = more words shared with more cluster members
        score = sum(freq[w] for w in ws if freq[w] > 1)
        scores.append((score, i))

    scores.sort(reverse=True)
    if scores and scores[0][0] > 0:
        return arts[scores[0][1]]

    # Fallback: median length
    sorted_arts = sorted(arts, key=lambda a: len(a.get('headline', '')))
    return sorted_arts[len(sorted_arts) // 2]


def main():
    fps = load_fingerprints()
    bias_map = load_source_bias()

    articles = []
    with open(CACHE) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                a = json.loads(line)
                if not a.get('headline'):
                    continue
                articles.append(a)
            except Exception:
                continue

    print(f'Loaded {len(articles)} articles')

    # high_freq_entities is computed here (same logic as inside event_clusterer)
    # because downstream story-entity extraction also needs it. The clusterer
    # has its own internal copy for its own work; this one feeds the loop at
    # line ~649 that builds each story's entity_list. Kept identical so the
    # filter behaviour is unchanged from pre-extraction.
    _raw_entity_freq = defaultdict(int)
    for _art in articles:
        for _w in re.findall(r'\b[A-Z][a-zA-Z]{4,}\b', _art.get('headline', '')):
            if _w.lower() not in STOP_WORDS and _w not in GENERIC_ENTITIES:
                _raw_entity_freq[_w] += 1
    _freq_threshold = len(articles) * 0.30
    high_freq_entities = {_w for _w, _cnt in _raw_entity_freq.items() if _cnt > _freq_threshold}

    # ── Path B Week 1 — Clustering delegated to event_clusterer ──────────
    # The inline 5-pass clustering (originally lines 538-623) has been moved
    # to book_arm/pai_modules/event_clusterer.py. The module reads news_cache
    # directly, writes clusters.jsonl, and we re-join clusters with articles
    # by hash to preserve the downstream (label, arts) shape unchanged.
    # Fixture-equivalence test: tests/test_event_clusterer.py.
    import sys as _sys
    _REPO_ROOT = Path(__file__).resolve().parents[2]
    if str(_REPO_ROOT) not in _sys.path:
        _sys.path.insert(0, str(_REPO_ROOT))
    from book_arm.pai_modules.event_clusterer import run as run_event_clusterer

    clusters_path = _REPO_ROOT / 'book_arm' / 'memory' / 'clusters.jsonl'
    run_event_clusterer(CACHE, clusters_path)

    # ── Path B Week 2 — Bias scoring delegated to bias_scorer ────────────
    from book_arm.pai_modules.bias_scorer import run as run_bias_scorer
    scored_path = _REPO_ROOT / 'book_arm' / 'memory' / 'scored.jsonl'
    run_bias_scorer(clusters_path, scored_path)

    # ── Path B Week 3 — Framing assembly delegated to framing_differ ─────
    from book_arm.pai_modules.framing_differ import run as run_framing_differ
    framings_path = _REPO_ROOT / 'book_arm' / 'memory' / 'framings.jsonl'
    run_framing_differ(scored_path, framings_path, CACHE)

    framed_by_cid = {}
    with open(framings_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if not _line:
                continue
            _fr = json.loads(_line)
            framed_by_cid[_fr['cluster_id']] = _fr

    # ── Path B Week 4 — Blindspot detection delegated to blindspot_analyzer ─
    from book_arm.pai_modules.blindspot_analyzer import run as run_blindspot
    blindspots_path = _REPO_ROOT / 'book_arm' / 'memory' / 'blindspots.jsonl'
    run_blindspot(framings_path, blindspots_path, SOURCES_GLOBAL, CACHE)

    blindspot_by_cid = {}
    with open(blindspots_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if not _line:
                continue
            _bs = json.loads(_line)
            blindspot_by_cid[_bs['cluster_id']] = _bs

    # ── Path B Week 5 — Coverage projection delegated to coverage_mapper ────
    from book_arm.pai_modules.coverage_mapper import run as run_coverage_mapper
    coverage_path = _REPO_ROOT / 'book_arm' / 'memory' / 'coverage.jsonl'
    run_coverage_mapper(blindspots_path, coverage_path)

    scored_by_cid = {}
    with open(scored_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if not _line:
                continue
            _s = json.loads(_line)
            scored_by_cid[_s['cluster_id']] = _s

    # Index articles by hash so we can re-attach full article dicts to
    # clusters that came back from disk carrying only member_hashes.
    art_by_hash = {(a.get('hash') or a.get('url', '')): a for a in articles}

    clusters = []  # (cluster_id, label, arts) — extended from Week 1 to carry cluster_id
    with open(clusters_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if not _line:
                continue
            _c = json.loads(_line)
            _cluster_arts = [art_by_hash[h] for h in _c['member_hashes'] if h in art_by_hash]
            if _cluster_arts:
                clusters.append((_c['cluster_id'], _c['label'], _cluster_arts))

    print(f'Clusters: {len(clusters)}  (extracted module event_clusterer.py + bias_scorer.py)')

    # Build story objects
    stories = []
    for cluster_id, label, arts in clusters[:TARGET_STORIES]:
        # ── Path B Week 3 — consensus + summary from framing_differ ────
        framed = framed_by_cid.get(cluster_id, {})
        headline = framed.get('consensus_headline', label)
        summary  = framed.get('consensus_summary', '') or ''

        # ── Path B Week 2 — bias data sourced from bias_scorer.run() output
        # sources_enriched carries: id, bias_tier, bias_bucket, geo_cluster,
        # bloc, atlanticist_norm. We merge in name/country/article fields
        # from the cluster's articles to produce the final sources list shape
        # the downstream story dict expects.
        scored = scored_by_cid.get(cluster_id, {})
        enriched_by_id = {s['id']: s for s in scored.get('sources_enriched', [])}
        seen_src = {}
        for a in arts:
            src_id = a.get('source', '')
            if src_id and src_id not in seen_src:
                e = enriched_by_id.get(src_id, {})
                seen_src[src_id] = {
                    'id':          src_id,
                    'name':        a.get('source_name', src_id),
                    'country':     a.get('country', ''),
                    'bloc':        e.get('bloc', 'neutral'),
                    'bias_tier':   e.get('bias_tier', 'unknown'),
                    'bias_bucket': e.get('bias_bucket', 'center'),
                    'geo_cluster': e.get('geo_cluster') or '',
                }
        sources = list(seen_src.values())

        # ── Path B Week 4 — coverage + blindspot from blindspot_analyzer ──
        bs_data = blindspot_by_cid.get(cluster_id, {})
        cov = {
            'left_pct':       bs_data.get('left_pct', 0),
            'center_pct':     bs_data.get('center_pct', 0),
            'right_pct':      bs_data.get('right_pct', 0),
            'state_count':    bs_data.get('state_count', 0),
            'dominant_bucket': bs_data.get('dominant_bucket', 'center'),
            'dominant_pct':   bs_data.get('dominant_pct', 0),
        }
        is_blindspot = bs_data.get('is_blindspot', False)
        blindspot_side = bs_data.get('blindspot_side', None)
        bs_score = bs_data.get('blindspot_score', 0.0)

        # ── Path B Week 2 — bias_variance from bias_scorer output ──────
        bias_variance = scored.get('bias_variance', 0.0)

        # Latest published timestamp across cluster
        pub_dates = [a.get('published', '') for a in arts if a.get('published', '')]
        pub_dates.sort(reverse=True)
        published = pub_dates[0] if pub_dates else ''

        # ── Path B Week 3 — image/video + article_cards from framing_differ ──
        image_url = framed.get('image_url')
        video_url = framed.get('video_url')
        article_cards = framed.get('article_cards', [])

        # Unique entities in cluster
        all_entities = set()
        for a in arts:
            all_entities.update(extract_entities(a.get('headline', ''), freq_filter=high_freq_entities))

        # ── Path B Week 4 — geo-frame from blindspot_analyzer ──────────
        gf = {
            'geo_frame':       bs_data.get('geo_frame'),
            'geo_frame_label': bs_data.get('geo_frame_label'),
            'geo_frame_topic': bs_data.get('geo_frame_topic'),
            'geo_breakdown':   bs_data.get('geo_breakdown', {}),
        }

        # ── Path B Week 2 — 5-axis avg + fp_source_count from bias_scorer ──
        axis_avg = scored.get('axis_avg', {k: None for k in ['interventionist','zionist','atlanticist','statist','financialized']})
        fp_source_count = scored.get('fp_source_count', 0)

        story_id = hashlib.md5(label.encode()).hexdigest()[:12]

        # ── Path B Week 4 — blindspot_label from blindspot_analyzer ────
        blindspot_label = bs_data.get('blindspot_label')

        stories.append({
            'id':              story_id,
            'headline':        headline,
            'summary':         summary[:300] if summary else '',
            'published':       published,
            'image_url':       image_url,
            'video_url':       video_url,
            'has_video':       video_url is not None,
            'is_blindspot':    is_blindspot,
            'blindspot_label': blindspot_label,
            'blindspot_score': round(bs_score, 1),
            'coverage': {
                'left_pct':       cov['left_pct'],
                'center_pct':     cov['center_pct'],
                'right_pct':      cov['right_pct'],
                'state_count':    cov['state_count'],
                'dominant':       cov['dominant_bucket'],
                'dominant_pct':   cov['dominant_pct'],
            },
            'bias_variance':   bias_variance,
            'entity_count':    len(all_entities),
            'entity_list':     sorted(list(all_entities)),
            'sources':         sources,
            'articles':        article_cards,
            'axis_avg':        axis_avg,
            'fp_source_count': fp_source_count,
            'geo_frame':       gf['geo_frame'],
            'geo_frame_label': gf['geo_frame_label'],
            'geo_frame_topic': gf['geo_frame_topic'],
            'geo_breakdown':   gf['geo_breakdown'],
            'section':         classify_story(sources, headline),
        })

    # Sort: geo-frame + blindspot stories first, then by source count
    def sort_key(s):
        geo_priority = 2 if s['geo_frame'] == 'blackout' else 1 if s['geo_frame'] == 'mono-frame' else 0
        return (-geo_priority, -s['blindspot_score'], -len(s['sources']))
    stories.sort(key=sort_key)

    # Build ordered section manifest — only sections that have stories, in newspaper order
    from collections import defaultdict as _dd
    section_buckets = _dd(list)
    for s in stories:
        section_buckets[s['section']].append(s)

    # Front-page = top 6 highest-signal stories regardless of section
    front_page_stories = stories[:6]
    for s in front_page_stories:
        s['is_front_page'] = True

    sections_manifest = []
    for sec in SECTION_ORDER:
        if sec == 'front-page':
            if front_page_stories:
                sections_manifest.append({'id': 'front-page', 'label': 'Front Page', 'count': len(front_page_stories)})
        elif sec in section_buckets:
            sections_manifest.append({'id': sec, 'label': sec.replace('-', ' ').title(), 'count': len(section_buckets[sec])})
    # Any section not in SECTION_ORDER gets appended
    for sec, bucket in section_buckets.items():
        if sec not in SECTION_ORDER:
            sections_manifest.append({'id': sec, 'label': sec.title(), 'count': len(bucket)})

    # ── Path B Week 6 — Broadcast serialization delegated to broadcast.py ──
    from book_arm.pai_modules.broadcast import run as run_broadcast
    run_broadcast(
        stories=stories,
        articles=articles,
        sections_manifest=sections_manifest,
        output_path=OUTPUT,
        blindspots_path=OUTPUT.parent / 'blindspots.json',
    )
    print(f'Wrote {len(stories)} stories to {OUTPUT}')

    # Stats
    blindspots  = sum(1 for s in stories if s['is_blindspot'])
    mono_frames = sum(1 for s in stories if s['geo_frame'] == 'mono-frame')
    blackouts   = sum(1 for s in stories if s['geo_frame'] == 'blackout')
    avg_sources = sum(len(s['sources']) for s in stories) / max(len(stories), 1)
    print(f'Blindspots: {blindspots} | Mono-Frame: {mono_frames} | Blackout: {blackouts} | Avg sources/story: {avg_sources:.1f}')
    print('Sample headlines (with coverage):')
    for s in stories[:10]:
        cov = s['coverage']
        flags = []
        if s['blindspot_label']:
            flags.append(f'⚑ {s["blindspot_label"]}')
        if s['geo_frame_label']:
            flags.append(f'◉ {s["geo_frame_label"]}')
        flag_str = ' '.join(flags)
        print(f'  L{cov["left_pct"]}%/C{cov["center_pct"]}%/R{cov["right_pct"]}%'
              f' [{len(s["sources"])} src] {flag_str} {s["headline"][:55]}')


if __name__ == '__main__':
    main()
