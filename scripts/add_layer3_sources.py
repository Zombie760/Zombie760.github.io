#!/usr/bin/env python3
"""Layer 3 source expansion — 12 RESUME-specified targets."""
import json
import sys
from collections import Counter
from pathlib import Path

SOURCES_PATH = Path('book_arm/memory/sources_global.json')

LAYER3 = [
    # Latin America
    {"id": "la_nacion_ar", "name": "La Nación (Argentina)", "country": "AR", "language": "es",
     "feed_url": "https://www.lanacion.com.ar/arcio/rss/", "feed_type": "rss", "fetch_method": "rss",
     "categories": ["mainstream"]},
    {"id": "o_globo", "name": "O Globo (Brazil)", "country": "BR", "language": "pt",
     "feed_url": "https://oglobo.globo.com/rss.xml", "feed_type": "rss", "fetch_method": "rss",
     "categories": ["mainstream"]},
    {"id": "el_tiempo_co", "name": "El Tiempo (Colombia)", "country": "CO", "language": "es",
     "feed_url": "https://www.eltiempo.com/rss/portada.xml", "feed_type": "rss", "fetch_method": "rss",
     "categories": ["mainstream"]},

    # Southeast Asia
    {"id": "straits_times", "name": "The Straits Times (Singapore)", "country": "SG", "language": "en",
     "feed_url": "https://www.straitstimes.com/news/world/rss.xml", "feed_type": "rss", "fetch_method": "rss",
     "categories": ["mainstream", "state-aligned"]},
    {"id": "bernama", "name": "Bernama (Malaysia)", "country": "MY", "language": "en",
     "feed_url": "https://www.bernama.com/services/rss/rss.php?id=1", "feed_type": "rss", "fetch_method": "rss",
     "categories": ["state-funded", "wire"]},
    {"id": "antaranews", "name": "Antaranews (Indonesia)", "country": "ID", "language": "en",
     "feed_url": "https://en.antaranews.com/rss/news.xml", "feed_type": "rss", "fetch_method": "rss",
     "categories": ["state-funded", "wire"]},

    # Africa
    {"id": "daily_nation_ke", "name": "Daily Nation (Kenya)", "country": "KE", "language": "en",
     "feed_url": "https://nation.africa/kenya/rss", "feed_type": "rss", "fetch_method": "rss",
     "categories": ["mainstream"]},
    {"id": "punch_ng", "name": "Punch Nigeria", "country": "NG", "language": "en",
     "feed_url": "https://punchng.com/feed", "feed_type": "rss", "fetch_method": "rss",
     "categories": ["mainstream"]},

    # MENA
    {"id": "arab_weekly", "name": "The Arab Weekly", "country": "GB", "language": "en",
     "feed_url": "https://thearabweekly.com/feed", "feed_type": "rss", "fetch_method": "rss",
     "categories": ["independent", "middle-east"]},

    # Former Soviet
    {"id": "meduza_en", "name": "Meduza (English)", "country": "LV", "language": "en",
     "feed_url": "https://meduza.io/rss/all", "feed_type": "rss", "fetch_method": "rss",
     "categories": ["independent", "exile-media", "anti-kremlin"]},
    {"id": "mediazona", "name": "Mediazona (English)", "country": "RU", "language": "en",
     "feed_url": "https://en.zona.media/rss", "feed_type": "rss", "fetch_method": "rss",
     "categories": ["independent", "human-rights", "anti-kremlin"]},
    {"id": "eurasianet", "name": "Eurasianet", "country": "US", "language": "en",
     "feed_url": "https://eurasianet.org/rss.xml", "feed_type": "rss", "fetch_method": "rss",
     "categories": ["independent", "central-asia", "caucasus"]},
]

SCHEMA_DEFAULTS = {
    "url_home": "",
    "ownership_chain": [],
    "historical_propaganda_flags": [],
    "foreshadowed_kinetic": False,
    "confidence": 0.7,
    "foreshadow_details": "",
    "notes": "",
}


def main(dry_run=False):
    sg = json.loads(SOURCES_PATH.read_text())
    sources = sg['sources']
    existing_ids = {s['id'] for s in sources}

    added, skipped = [], []
    for src in LAYER3:
        if src['id'] in existing_ids:
            skipped.append(src['id'])
            continue
        entry = {**SCHEMA_DEFAULTS, **{
            'id': src['id'],
            'name': src['name'],
            'country': src['country'],
            'language': src.get('language', 'en'),
            'url_home': src.get('url_home', ''),
            'feed_url': src['feed_url'],
            'feed_type': src.get('feed_type', 'rss'),
            'fetch_method': src.get('fetch_method', 'rss'),
            'categories': src.get('categories', []),
        }}
        sources.append(entry)
        existing_ids.add(src['id'])
        added.append(src['id'])

    cc = Counter(s['country'] for s in sources)
    sg['_meta']['total_sources'] = len(sources)
    sg['_meta']['by_country'] = dict(cc.most_common())
    sg['_meta']['layer3_date'] = '2026-05-09'

    print(f'Added:   {len(added)} — {added}')
    print(f'Skipped: {len(skipped)} — {skipped}')
    print(f'Total:   {len(sources)} sources')

    if dry_run:
        print('DRY RUN — no file written.')
        return

    SOURCES_PATH.write_text(json.dumps(sg, indent=2, ensure_ascii=False))
    print(f'Written to {SOURCES_PATH}')
    new_countries = sorted(set(s['country'] for s in sources if s['id'] in set(added)))
    print(f'New countries covered: {new_countries}')


if __name__ == '__main__':
    main(dry_run='--dry-run' in sys.argv)
