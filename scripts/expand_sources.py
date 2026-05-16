#!/usr/bin/env python3
"""
Layer 2 source expansion — adds ~200 sources to sources_global.json.

Run: python3 zombie760.github.io/scripts/expand_sources.py
Dry: python3 zombie760.github.io/scripts/expand_sources.py --dry-run
"""
import json
import sys
from pathlib import Path

SOURCES_PATH = Path('book_arm/memory/sources_global.json')

# ── 34 already fingerprinted, missing from global ──────────────────────────
FINGERPRINTED_GAPS = [
    # Major US outlets
    {"id":"abc_news","name":"ABC News","country":"US","language":"en",
     "feed_url":"https://abcnews.go.com/abcnews/topstories","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","broadcast"]},
    {"id":"cbs_news","name":"CBS News","country":"US","language":"en",
     "feed_url":"https://www.cbsnews.com/latest/rss/main","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","broadcast"]},
    {"id":"nbc_news","name":"NBC News","country":"US","language":"en",
     "feed_url":"https://feeds.nbcnews.com/nbcnews/public/news","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","broadcast"]},
    {"id":"msnbc","name":"MSNBC","country":"US","language":"en",
     "feed_url":"https://feeds.nbcnews.com/msnbc/public/news","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","left-leaning"]},
    {"id":"fox_news","name":"Fox News","country":"US","language":"en",
     "feed_url":"https://moxie.foxnews.com/google-publisher/latest.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","right-leaning"]},
    {"id":"npr","name":"NPR","country":"US","language":"en",
     "feed_url":"https://feeds.npr.org/1001/rss.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["public-radio","mainstream"]},
    {"id":"pbs","name":"PBS NewsHour","country":"US","language":"en",
     "feed_url":"https://www.pbs.org/newshour/feeds/rss/headlines","feed_type":"rss","fetch_method":"rss",
     "categories":["public-tv","mainstream"]},
    {"id":"politico","name":"Politico","country":"US","language":"en",
     "feed_url":"https://rss.politico.com/politics-news.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["political","mainstream"]},
    {"id":"the_hill","name":"The Hill","country":"US","language":"en",
     "feed_url":"https://thehill.com/news/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["political","mainstream"]},
    {"id":"ny_post","name":"New York Post","country":"US","language":"en",
     "feed_url":"https://nypost.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["tabloid","right-leaning"]},
    {"id":"newsmax","name":"Newsmax","country":"US","language":"en",
     "feed_url":"https://www.newsmax.com/rss/Newsfront/16","feed_type":"rss","fetch_method":"rss",
     "categories":["right-leaning","alternative"]},
    {"id":"breitbart","name":"Breitbart","country":"US","language":"en",
     "feed_url":"https://feeds.feedburner.com/breitbart","feed_type":"rss","fetch_method":"rss",
     "categories":["right-wing","alternative"]},
    {"id":"daily_wire","name":"The Daily Wire","country":"US","language":"en",
     "feed_url":"https://www.dailywire.com/feeds/rss.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["right-wing","alternative"]},
    {"id":"national_review","name":"National Review","country":"US","language":"en",
     "feed_url":"https://www.nationalreview.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["right-leaning","conservative"]},
    {"id":"washington_examiner","name":"Washington Examiner","country":"US","language":"en",
     "feed_url":"https://www.washingtonexaminer.com/section/news/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["right-leaning"]},
    {"id":"washington_times","name":"Washington Times","country":"US","language":"en",
     "feed_url":"https://www.washingtontimes.com/rss/headlines/news","feed_type":"rss","fetch_method":"rss",
     "categories":["right-leaning"]},
    {"id":"the_intercept","name":"The Intercept","country":"US","language":"en",
     "feed_url":"https://theintercept.com/feed/?rss","feed_type":"rss","fetch_method":"rss",
     "categories":["investigative","left-leaning"]},
    # UK
    {"id":"the_guardian","name":"The Guardian","country":"GB","language":"en",
     "feed_url":"https://www.theguardian.com/world/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","left-leaning"]},
    {"id":"the_times_uk","name":"The Times (UK)","country":"GB","language":"en",
     "feed_url":"https://www.thetimes.co.uk/rss/world","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","establishment"]},
    {"id":"telegraph","name":"The Telegraph","country":"GB","language":"en",
     "feed_url":"https://www.telegraph.co.uk/rss.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","right-leaning"]},
    {"id":"daily_mail","name":"Daily Mail","country":"GB","language":"en",
     "feed_url":"https://www.dailymail.co.uk/articles.rss","feed_type":"rss","fetch_method":"rss",
     "categories":["tabloid","right-leaning"]},
    {"id":"independent_uk","name":"The Independent (UK)","country":"GB","language":"en",
     "feed_url":"https://www.independent.co.uk/news/world/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","centrist"]},
    # Europe
    {"id":"der_spiegel","name":"Der Spiegel (English)","country":"DE","language":"en",
     "feed_url":"https://www.spiegel.de/international/index.rss","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","investigative"]},
    {"id":"dn_se","name":"Dagens Nyheter","country":"SE","language":"sv",
     "feed_url":"https://www.dn.se/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"telex","name":"Telex (Hungary)","country":"HU","language":"hu",
     "feed_url":"https://telex.hu/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["investigative","independent"]},
    # Middle East / Israel
    {"id":"haaretz","name":"Haaretz (English)","country":"IL","language":"en",
     "feed_url":"https://www.haaretz.com/cmlink/1.4282966","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","left-leaning"]},
    {"id":"al_jazeera","name":"Al Jazeera English","country":"QA","language":"en",
     "feed_url":"https://www.aljazeera.com/xml/rss/all.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["state-funded","non-western"]},
    {"id":"bbc_arabic","name":"BBC Arabic","country":"GB","language":"ar",
     "feed_url":"https://feeds.bbci.co.uk/arabic/rss.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","broadcast"]},
    {"id":"rt_russia","name":"RT (Russia Today)","country":"RU","language":"en",
     "feed_url":"https://www.rt.com/rss/news","feed_type":"rss","fetch_method":"rss",
     "categories":["state-funded","adversarial"]},
    {"id":"wall_street_journal","name":"Wall Street Journal","country":"US","language":"en",
     "feed_url":"https://feeds.a.dj.com/rss/RSSWorldNews.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["financial","mainstream"]},
]

# ── New regions — zero coverage today ─────────────────────────────────────
NEW_REGIONS = [
    # Turkey (0 sources currently)
    {"id":"daily_sabah","name":"Daily Sabah","country":"TR","language":"en",
     "feed_url":"https://www.dailysabah.com/rssFeed/politics","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","state-aligned"]},
    {"id":"hurriyet_daily","name":"Hürriyet Daily News","country":"TR","language":"en",
     "feed_url":"https://www.hurriyetdailynews.com/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"trt_world","name":"TRT World","country":"TR","language":"en",
     "feed_url":"https://www.trtworld.com/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["state-funded","non-western"]},
    {"id":"bianet","name":"Bianet (Turkey)","country":"TR","language":"en",
     "feed_url":"https://m.bianet.org/bianet/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["independent","human-rights"]},

    # Pakistan (0 sources)
    {"id":"dawn","name":"Dawn","country":"PK","language":"en",
     "feed_url":"https://www.dawn.com/feeds/home","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","independent"]},
    {"id":"the_news_pk","name":"The News International","country":"PK","language":"en",
     "feed_url":"https://www.thenews.com.pk/rss/1/1","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"geo_news","name":"Geo News","country":"PK","language":"en",
     "feed_url":"https://www.geo.tv/rss/10","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","broadcast"]},
    {"id":"tribune_pk","name":"The Express Tribune","country":"PK","language":"en",
     "feed_url":"https://tribune.com.pk/feeds/home","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},

    # Indonesia (0 sources)
    {"id":"jakarta_post","name":"The Jakarta Post","country":"ID","language":"en",
     "feed_url":"https://www.thejakartapost.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"tempo_id","name":"Tempo (Indonesia)","country":"ID","language":"en",
     "feed_url":"https://en.tempo.co/rss/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","investigative"]},
    {"id":"kompas","name":"Kompas (Indonesia)","country":"ID","language":"id",
     "feed_url":"https://rsshub.app/kompas/index/terkini","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},

    # Philippines (0 sources)
    {"id":"inquirer_ph","name":"Philippine Daily Inquirer","country":"PH","language":"en",
     "feed_url":"https://newsinfo.inquirer.net/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"rappler","name":"Rappler","country":"PH","language":"en",
     "feed_url":"https://www.rappler.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["independent","investigative"]},
    {"id":"phil_star","name":"Philippine Star","country":"PH","language":"en",
     "feed_url":"https://www.philstar.com/rss/headlines","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},

    # Vietnam (0 sources)
    {"id":"vnexpress","name":"VnExpress International","country":"VN","language":"en",
     "feed_url":"https://e.vnexpress.net/rss/news.rss","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","state-aligned"]},
    {"id":"tuoi_tre","name":"Tuoi Tre News","country":"VN","language":"en",
     "feed_url":"https://tuoitrenews.vn/rss/ttne.rss","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},

    # Thailand (0 sources)
    {"id":"bangkok_post","name":"Bangkok Post","country":"TH","language":"en",
     "feed_url":"https://www.bangkokpost.com/rss/data/topstories.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"nation_th","name":"The Nation (Thailand)","country":"TH","language":"en",
     "feed_url":"https://www.nationthailand.com/rss.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},

    # Bangladesh (0 sources)
    {"id":"daily_star_bd","name":"The Daily Star (Bangladesh)","country":"BD","language":"en",
     "feed_url":"https://www.thedailystar.net/frontpage/rss.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"prothom_alo","name":"Prothom Alo (English)","country":"BD","language":"en",
     "feed_url":"https://en.prothomalo.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},

    # Africa additions
    {"id":"the_east_african","name":"The East African","country":"KE","language":"en",
     "feed_url":"https://www.theeastafrican.co.ke/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","regional"]},
    {"id":"daily_monitor_ug","name":"Daily Monitor (Uganda)","country":"UG","language":"en",
     "feed_url":"https://www.monitor.co.ug/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"new_frame","name":"New Frame (South Africa)","country":"ZA","language":"en",
     "feed_url":"https://www.newframe.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["independent","left-leaning"]},
    {"id":"daily_maverick","name":"Daily Maverick (SA)","country":"ZA","language":"en",
     "feed_url":"https://www.dailymaverick.co.za/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["independent","investigative"]},
    {"id":"ethiopia_reporter","name":"The Reporter (Ethiopia)","country":"ET","language":"en",
     "feed_url":"https://www.thereporterethiopia.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"allafrica","name":"AllAfrica","country":"NG","language":"en",
     "feed_url":"https://allafrica.com/tools/headlines/rdf/africa/headlines.rdf","feed_type":"rss","fetch_method":"rss",
     "categories":["aggregator","pan-african"]},

    # Latin America additions
    {"id":"telesur","name":"Telesur English","country":"VE","language":"en",
     "feed_url":"https://www.telesurenglish.net/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["state-funded","adversarial","latin-america"]},
    {"id":"la_jornada","name":"La Jornada","country":"MX","language":"es",
     "feed_url":"https://www.jornada.com.mx/rss/mundo.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["independent","left-leaning"]},
    {"id":"mercopress","name":"MercoPress","country":"UY","language":"en",
     "feed_url":"https://en.mercopress.com/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["regional","latin-america"]},
    {"id":"abc_color_py","name":"ABC Color (Paraguay)","country":"PY","language":"es",
     "feed_url":"https://www.abc.com.py/rss.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},

    # Central Asia (0 sources)
    {"id":"astana_times","name":"The Astana Times","country":"KZ","language":"en",
     "feed_url":"https://astanatimes.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","state-aligned"]},
    {"id":"kabar_kg","name":"Kabar (Kyrgyzstan)","country":"KG","language":"en",
     "feed_url":"https://kabar.kg/eng/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["state-funded"]},

    # Middle East additions
    {"id":"arab_news","name":"Arab News","country":"SA","language":"en",
     "feed_url":"https://www.arabnews.com/rss.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","state-aligned"]},
    {"id":"jordan_times","name":"Jordan Times","country":"JO","language":"en",
     "feed_url":"https://www.jordantimes.com/rss.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"al_monitor","name":"Al-Monitor","country":"US","language":"en",
     "feed_url":"https://www.al-monitor.com/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["regional","middle-east","independent"]},
    {"id":"middle_east_eye","name":"Middle East Eye","country":"GB","language":"en",
     "feed_url":"https://www.middleeasteye.net/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["independent","non-western"]},
    {"id":"jerusalem_post","name":"Jerusalem Post","country":"IL","language":"en",
     "feed_url":"https://www.jpost.com/Rss/RssFeedsHeadlines.aspx","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","right-leaning"]},
    {"id":"ynet","name":"Ynetnews","country":"IL","language":"en",
     "feed_url":"https://www.ynet.co.il/Integration/StoryRss2.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"times_of_israel","name":"Times of Israel","country":"IL","language":"en",
     "feed_url":"https://www.timesofisrael.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"iran_international","name":"Iran International","country":"GB","language":"en",
     "feed_url":"https://www.iranintl.com/en/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["independent","anti-regime"]},

    # India additions (more depth beyond current)
    {"id":"the_wire_in","name":"The Wire (India)","country":"IN","language":"en",
     "feed_url":"https://thewire.in/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["independent","investigative"]},
    {"id":"ndtv","name":"NDTV","country":"IN","language":"en",
     "feed_url":"https://feeds.feedburner.com/NdtvNews-TopStories","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","broadcast"]},
    {"id":"the_print","name":"The Print (India)","country":"IN","language":"en",
     "feed_url":"https://theprint.in/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream","independent"]},
    {"id":"scroll_in","name":"Scroll.in","country":"IN","language":"en",
     "feed_url":"https://scroll.in/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["independent"]},

    # South Korea / Japan additions
    {"id":"korea_herald","name":"Korea Herald","country":"KR","language":"en",
     "feed_url":"http://www.koreaherald.com/common/rss_xml.php?ct=020100000000","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},
    {"id":"hankyoreh","name":"Hankyoreh (English)","country":"KR","language":"en",
     "feed_url":"https://english.hani.co.kr/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["independent","progressive"]},
    {"id":"mainichi","name":"Mainichi Shimbun (English)","country":"JP","language":"en",
     "feed_url":"https://mainichi.jp/rss/etc/mainichi-flash.rss","feed_type":"rss","fetch_method":"rss",
     "categories":["mainstream"]},

    # Caucasus / Eastern Europe
    {"id":"civil_ge","name":"Civil.ge (Georgia)","country":"GE","language":"en",
     "feed_url":"https://civil.ge/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["independent"]},
    {"id":"azernews","name":"AzerNews (Azerbaijan)","country":"AZ","language":"en",
     "feed_url":"https://www.azernews.az/rss/rss.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["state-aligned"]},
    {"id":"armenpress","name":"Armenpress","country":"AM","language":"en",
     "feed_url":"https://armenpress.am/eng/rss/news","feed_type":"rss","fetch_method":"rss",
     "categories":["state-funded"]},

    # Balkans
    {"id":"balkan_insight","name":"Balkan Insight (BIRN)","country":"RS","language":"en",
     "feed_url":"https://balkaninsight.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["investigative","independent"]},
    {"id":"exit_al","name":"Exit News (Albania)","country":"AL","language":"en",
     "feed_url":"https://exit.al/en/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["independent"]},

    # Oceania depth
    {"id":"abc_au","name":"ABC Australia","country":"AU","language":"en",
     "feed_url":"https://www.abc.net.au/news/feed/45910/rss.xml","feed_type":"rss","fetch_method":"rss",
     "categories":["public-broadcast","mainstream"]},

    # International wires (not yet in global)
    {"id":"afp_english","name":"AFP (Agence France-Presse)","country":"FR","language":"en",
     "feed_url":"https://www.afp.com/en/latest-news/afp-news","feed_type":"rss","fetch_method":"rss",
     "categories":["wire","mainstream"]},
    {"id":"dpa_international","name":"dpa International","country":"DE","language":"en",
     "feed_url":"https://www.dpa-international.com/rss","feed_type":"rss","fetch_method":"rss",
     "categories":["wire","mainstream"]},

    # Myanmar / Southeast Asia conflict zone
    {"id":"myanmar_now","name":"Myanmar Now","country":"MM","language":"en",
     "feed_url":"https://myanmar-now.org/en/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["independent","conflict-zone"]},
    {"id":"irrawaddy","name":"The Irrawaddy","country":"MM","language":"en",
     "feed_url":"https://www.irrawaddy.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["independent","exile-media"]},

    # Cuba / Caribbean
    {"id":"havana_times","name":"Havana Times","country":"CU","language":"en",
     "feed_url":"https://havanatimes.org/?feed=rss2","feed_type":"rss","fetch_method":"rss",
     "categories":["independent","critical"]},
    {"id":"caribbean_journal","name":"Caribbean Journal","country":"BB","language":"en",
     "feed_url":"https://caribjournal.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["regional"]},

    # Investigative / cross-border (deep moat)
    {"id":"occrp","name":"OCCRP (Organized Crime & Corruption)","country":"RO","language":"en",
     "feed_url":"https://www.occrp.org/en/news?format=feed","feed_type":"rss","fetch_method":"rss",
     "categories":["investigative","corruption","cross-border"]},
    {"id":"bellingcat","name":"Bellingcat","country":"NL","language":"en",
     "feed_url":"https://www.bellingcat.com/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["investigative","osint"]},
    {"id":"icij","name":"ICIJ (Int'l Consortium of Investigative Journalists)","country":"US","language":"en",
     "feed_url":"https://www.icij.org/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["investigative","cross-border"]},
    {"id":"ipi_media","name":"International Press Institute","country":"AT","language":"en",
     "feed_url":"https://ipi.media/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["press-freedom","meta-media"]},
    {"id":"freedom_press_fdn","name":"Freedom of the Press Foundation","country":"US","language":"en",
     "feed_url":"https://freedom.press/feed","feed_type":"rss","fetch_method":"rss",
     "categories":["press-freedom","investigative"]},

    # Science / tech with geopolitical angle
    {"id":"mit_tech_review","name":"MIT Technology Review","country":"US","language":"en",
     "feed_url":"https://www.technologyreview.com/topnews.rss","feed_type":"rss","fetch_method":"rss",
     "categories":["tech","academic"]},
    {"id":"rest_of_world","name":"Rest of World","country":"US","language":"en",
     "feed_url":"https://restofworld.org/feed/latest","feed_type":"rss","fetch_method":"rss",
     "categories":["tech","global-south"]},
]


def main(dry_run=False):
    sg = json.loads(SOURCES_PATH.read_text())
    sources = sg['sources']
    existing_ids = {s['id'] for s in sources}

    all_new = FINGERPRINTED_GAPS + NEW_REGIONS

    added = []
    skipped = []
    for src in all_new:
        src_id = src['id']
        if src_id in existing_ids:
            skipped.append(src_id)
            continue
        # Normalize schema to match existing entries
        entry = {
            'id':         src['id'],
            'name':       src['name'],
            'country':    src['country'],
            'language':   src.get('language', 'en'),
            'url_home':   src.get('url_home', ''),
            'feed_url':   src['feed_url'],
            'feed_type':  src.get('feed_type', 'rss'),
            'fetch_method': src.get('fetch_method', 'rss'),
            'categories': src.get('categories', []),
            'notes':      src.get('notes', ''),
            'ownership_chain': [],
            'historical_propaganda_flags': [],
            'foreshadowed_kinetic': False,
            'confidence': 0.7,
            'foreshadow_details': '',
        }
        sources.append(entry)
        existing_ids.add(src_id)
        added.append(src_id)

    print(f'Added:   {len(added)} sources')
    print(f'Skipped: {len(skipped)} (already present)')
    print(f'Total:   {len(sources)} sources')

    # Update _meta counts
    from collections import Counter
    by_country = Counter(s['country'] for s in sources)
    sg['_meta']['total_sources'] = len(sources)
    sg['_meta']['by_country'] = dict(by_country.most_common())
    sg['_meta']['expansion_date'] = '2026-05-09'

    if dry_run:
        print('\nDRY RUN — no file written.')
        print('New IDs:', added[:10], '...' if len(added) > 10 else '')
    else:
        SOURCES_PATH.write_text(json.dumps(sg, indent=2, ensure_ascii=False))
        print(f'Written to {SOURCES_PATH}')
        print('New country codes:', sorted(set(s['country'] for s in sources
                                              if s['id'] in set(added))))

if __name__ == '__main__':
    dry = '--dry-run' in sys.argv
    main(dry_run=dry)
