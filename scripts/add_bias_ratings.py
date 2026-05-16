#!/usr/bin/env python3
"""
Add bias_tier + geo_cluster to every source in sources_global.json.

bias_tier: 7-tier Ground News-style spectrum
  far-left | left | lean-left | center | lean-right | right | far-right
  + state-pro (authoritarian state media)
  + state-democratic (public broadcasters in democracies)
  + independent (investigative, non-partisan)
  + unknown

geo_cluster: which world-view bloc
  west | global-south | adversarial | middle-east | pacific-asia
  latin-america | africa | eastern-europe | central-asia
"""

import json
from pathlib import Path

SOURCES_PATH = Path('/var/home/gringo/Botwave-Master/book_arm/memory/sources_global.json')

# ── Known bias tiers (AllSides/MBFC/AdFontes sourced where possible) ──────────
BIAS = {
    # Wire services
    "reuters": "center", "reuters_business": "center",
    "ap_news": "lean-left",   # AllSides rates AP lean-left
    "afp": "center", "afp_english": "center",

    # US mainstream broadcast/digital
    "abc_news": "lean-left", "cbs_news": "lean-left", "nbc_news": "lean-left",
    "msnbc": "left", "cnn": "lean-left",
    "fox_news": "right", "newsmax": "far-right",
    "ny_post": "right", "breitbart": "far-right", "daily_wire": "far-right",
    "national_review": "lean-right", "washington_examiner": "lean-right",
    "washington_times": "right",
    "npr": "lean-left", "pbs": "lean-left",

    # US print
    "nytimes": "left", "washington_post": "left",
    "wsj": "lean-right", "wall_street_journal": "lean-right",
    "bloomberg": "lean-left", "bloomberg_markets": "lean-left",

    # US digital/political
    "politico": "lean-left", "the_hill": "center", "axios": "lean-left",
    "huffpost": "left", "vox": "left", "slate": "left",
    "daily_beast": "lean-left", "vice_news": "left",
    "the_intercept": "left", "intercept": "left",
    "greyzone": "far-left", "mint_press": "far-left",
    "consortium_news": "far-left",
    "logic_mag": "left", "rest_of_world": "lean-left",
    "gizmodo": "lean-left", "techcrunch": "lean-left",
    "wired": "lean-left", "arstechnica": "lean-left",
    "platformer": "center", "stratechery": "lean-right",
    "404media": "lean-left", "mit_tech_review": "lean-left",
    "zerohedge": "far-right",

    # US investigative/OSINT
    "propublica": "lean-left", "icij": "independent",
    "bellingcat": "independent", "bureau_investigative": "independent",
    "wikileaks": "independent", "ddosecrets": "independent",
    "cryptome": "independent", "freedom_press_fdn": "independent",
    "eff_deeplinks": "independent", "schneier_blog": "independent",
    "krebsonsecurity": "independent", "occrp": "independent",

    # US finance / defense
    "cnbc": "center", "marketwatch": "center",
    "barrons": "lean-right", "seeking_alpha": "lean-right",
    "coin_desk": "center", "cointelegraph": "center",
    "foreign_policy": "lean-left", "foreign_affairs": "lean-left",
    "lawfare": "lean-left", "national_interest": "lean-right",
    "war_on_rocks": "center", "defense_news": "center",
    "breaking_defense": "center", "janes": "center",
    "army_times": "center", "air_force_times": "center",
    "navy_times": "center", "military_times": "center",
    "small_wars_journal": "center", "csis_analysis": "lean-right",

    # US aggregators
    "google_news": "center", "reddit_news": "center",
    "flipboard": "center", "smartnews": "center", "ground_news": "center",
    "al_monitor": "independent", "al_bab": "independent",
    "insider_inc": "lean-left",

    # UK
    "bbc_news": "center", "bbc_arabic": "center",
    "bbc_ar": "center", "bbc_fa": "center",
    "guardian": "left", "the_guardian": "left",
    "ft": "lean-right", "economist": "lean-right",
    "telegraph": "right", "daily_mail": "right",
    "independent_uk": "lean-left", "the_times_uk": "lean-right",
    "theregister": "center",
    "middle_east_eye": "independent", "arab_weekly": "independent",
    "janes": "center", "bureau_investigative": "independent",
    "ipi_media": "independent",

    # Germany
    "spiegel": "lean-left", "der_spiegel": "lean-left",
    "zeit": "lean-left", "faz": "lean-right",
    "sueddeutsche": "lean-left", "bild": "right",
    "dw": "state-democratic", "dw_ar": "state-democratic",
    "dw_africa": "state-democratic",
    "handelsblatt": "lean-right", "correctiv": "independent",
    "thelocal_de": "center",

    # France
    "le_monde": "lean-left", "le_figaro": "lean-right",
    "liberation": "left", "france24": "state-democratic",
    "afp": "center", "jeune_afrique": "lean-right",
    "disclose": "independent", "thelocal_fr": "center",

    # Italy
    "corriere": "lean-right", "repubblica": "lean-left",
    "sole24ore": "lean-right", "ansa": "center",
    "thelocal_it": "center",

    # Spain
    "el_pais": "lean-left", "el_mundo": "lean-right",
    "la_vanguardia": "lean-left", "thelocal_es": "center",

    # Netherlands
    "volkskrant": "lean-left", "nos": "state-democratic",
    "dutchnews": "center",

    # Belgium / Switzerland / Portugal / Austria / Greece
    "rts_info": "state-democratic", "rtbf_info": "state-democratic",
    "dn_portugal": "lean-left", "expresso_pt": "lean-right",
    "ipi_media": "independent", "kathimerini": "lean-right",
    "ekathimerini": "lean-right",

    # Nordics (public broadcasters = state-democratic)
    "svt_nyheter": "state-democratic", "dn_nyheter": "center",
    "nrk_en": "state-democratic", "nrk": "state-democratic",
    "dr_nyheder": "state-democratic", "dr_nyheter": "state-democratic",
    "yle_en": "state-democratic",
    "thelocal_se": "center",

    # Eastern Europe
    "wyborcza": "lean-left", "gazeta_pl": "lean-left",
    "rmf24": "center", "novinky_cz": "center", "denik_n": "independent",
    "telex_hu": "independent", "index_hu": "center",
    "g4media": "independent", "romanian_insider": "independent",
    "balkan_insight": "independent", "republic_mk": "center",
    "croatian_times": "center", "slovenian_times": "center",
    "vijesti_me": "center", "exit_al": "independent",

    # Baltic
    "err_ee": "state-democratic", "lrt_en": "state-democratic",
    "lrt_lt2": "state-democratic", "delfi_en": "center",
    "lsm_en": "state-democratic",

    # Russia — state
    "rt": "state-pro", "sputnik": "state-pro", "tass": "state-pro",
    "ria_novosti": "state-pro", "rt_russian": "state-pro",
    "rt_arabic": "state-pro",

    # Russia — independent/opposition
    "meduza": "independent", "meduza_en": "independent",
    "mediazona": "independent", "novaya_gazeta": "independent",
    "novaya_en": "independent",
    "kommersant": "center", "interfax": "center",
    "gazeta_ru": "lean-right", "lenta_ru": "center",

    # Ukraine
    "ukrainska_pravda_en": "independent", "pravda_ua": "independent",
    "kyiv_independent": "independent", "ukrinform_en": "state-democratic",

    # China — all state-pro
    "xinhua": "state-pro", "cgtn": "state-pro", "global_times": "state-pro",
    "china_daily": "state-pro", "xinhua_cn": "state-pro",
    "peopledaily_cn": "state-pro", "cgtn_es": "state-pro",
    "sixth_tone": "state-pro", "wenweipo": "state-pro",
    "scmp": "lean-right", "caixin": "center",
    "beijing_news": "center", "yicai": "center",
    "scmp_business": "lean-right",

    # Iran — all state-pro
    "tehran_times": "state-pro", "press_tv": "state-pro",
    "fars_news": "state-pro", "tasnim": "state-pro",
    "irna": "state-pro", "mehr_news": "state-pro",
    "isna": "state-pro", "alef_ir": "state-pro",

    # Venezuela state
    "telesur": "state-pro",

    # Gulf / Saudi — not adversarial to West but state-controlled
    "alarabiya": "lean-right", "asharq_awsat": "lean-right",
    "saudi_gazette": "state-pro", "arab_news": "lean-right",
    "gulf_news": "lean-right", "khalij_times": "lean-right",
    "thenational_ae": "lean-right", "the_national_ae": "lean-right",
    "skynews_ar": "lean-right",

    # Qatar
    "aljazeera": "lean-left", "al_jazeera": "lean-left",

    # Turkey
    "daily_sabah": "lean-right", "daily_sabah3": "lean-right",
    "hurriyet_en": "center", "hurriyet_daily": "center",
    "yeni_safak": "right",  # Pro-Erdogan
    "trt_world": "lean-right", "bianet": "lean-left",

    # Israel
    "haaretz_en": "lean-left", "haaretz": "lean-left",
    "times_of_israel": "center", "jpost": "lean-right",
    "jerusalem_post": "lean-right",
    "israel_hayom": "right",  # Adelson-funded
    "kan_news": "state-democratic", "ynet": "center",
    "walla_news": "center", "mako": "center",
    "nrg_maariv": "lean-right", "rotter_net": "center",
    "ynet_he": "center", "walla_he": "center",
    "iran_international": "independent",

    # Lebanon / Egypt / Jordan / Algeria / MENA
    "daily_star_lb": "center", "l_orient_le_jour": "center",
    "ahram": "state-pro", "egypt_independent": "independent",
    "jordan_times": "center", "algerie360": "center",
    "kurdistan24": "independent", "arab_weekly": "independent",
    "middle_east_m": "independent",

    # India
    "ndtv": "lean-left", "times_of_india": "center",
    "hindu": "lean-left", "indian_express": "lean-left",
    "firstpost": "lean-right", "wire_in": "lean-left",
    "scroll_in": "lean-left", "republic_tv": "right",
    "the_print": "center", "the_wire_in": "lean-left",
    "mint_lounge": "center", "economic_times": "center",

    # Pakistan
    "dawn": "center", "the_news_pk": "center",
    "geo_news": "center", "tribune_pk": "center",

    # Bangladesh / Sri Lanka / Nepal / Afghanistan
    "daily_star_bd": "center", "prothom_alo": "lean-left",
    "prothom_alo_en": "lean-left", "daily_ft_lk": "center",
    "kathmandu_post": "center", "himalayan_times": "center",
    "khaama": "independent", "pajhwok_en": "independent",

    # Southeast Asia
    "jakarta_post": "center", "tempo_id": "independent",
    "kompas": "center", "straits_times": "lean-right",
    "bernama": "state-democratic", "antaranews": "state-democratic",
    "nst_my": "center", "freemalaysia": "independent",
    "inquirer_ph": "center", "rappler": "independent",
    "phil_star": "center", "businessworld_ph": "center",
    "vnexpress": "center", "vnexpress_en": "center",
    "tuoi_tre": "center", "tuoitrenews": "center",
    "vietimes": "center", "bangkok_post": "center",
    "nation_th": "lean-right", "thai_pbs2": "state-democratic",
    "khaosod_en": "lean-left", "daily_ft_lk": "center",
    "myanmar_now": "independent", "irrawaddy": "independent",

    # Japan / Korea
    "asahi": "lean-left", "yomiuri": "lean-right",
    "nhk": "state-democratic", "mainichi_en": "lean-left",
    "nikkei_asia": "lean-right", "yonhap": "center",
    "korea_herald": "center", "korea_times": "center",
    "hankyoreh": "left", "hankyoreh_en": "left",
    "jiji_en": "center",

    # Australia / NZ / Canada
    "smh": "lean-left", "australian": "lean-right",
    "abc_au": "state-democratic", "abc_pacific": "state-democratic",
    "nz_herald": "center", "rnz_pacific": "state-democratic",
    "radio_nz_all": "state-democratic",
    "cbc": "lean-left", "globe_mail": "center",
    "national_post": "lean-right", "ctv": "lean-left",

    # Latin America
    "clarin": "lean-right", "clarin_ar": "lean-right",
    "lanacion": "lean-right", "la_nacion_ar": "lean-right",
    "pagina12": "left", "infobae": "lean-right",
    "eltiempo": "lean-right", "el_tiempo_co": "lean-right",
    "espectador": "lean-left", "el_espectador_co": "lean-left",
    "semana_co": "center",
    "mercurio": "right", "el_mercurio_cl": "right",
    "tercera": "lean-right", "la_tercera_cl": "lean-right",
    "ciper_cl": "independent",
    "reforma": "center", "jornada": "lean-left",
    "la_jornada_mx": "lean-left", "milenio": "lean-right",
    "animal_politico": "lean-left",
    "folha_sp": "lean-left", "globo": "center", "o_globo": "center",
    "estado_sp": "lean-right", "nexo_jornal": "lean-left",
    "valor_econ": "lean-right",
    "el_nacional_ve": "independent", "el_universo_ec": "center",
    "mercopress": "center", "la_razon_bo": "center",
    "prensa_libre": "center", "the_tico_times": "independent",
    "kaieteur_news": "independent", "guyana_chroni": "center",
    "el_dia_do": "center", "newsday_tt": "center",
    "jamaica_observer": "center", "the_gleaner_jm2": "center",
    "carib_natl_weekly": "center", "antigua_obs": "center",
    "abc_color_py": "lean-right",

    # Sub-Saharan Africa
    "premium_times": "independent", "premium_times_ng": "independent",
    "punch": "center", "punch_ng": "center",
    "daily_trust_ng": "center", "vanguard_ng": "center",
    "business_day_ng": "center", "thisday_ng": "center",
    "sunpaper_ng": "center", "daily_nation": "center",
    "daily_nation_ke": "center", "standard_kenya": "center",
    "business_daily_ke": "center", "business_day_za": "center",
    "mail_guardian": "lean-left", "mg_sa": "lean-left",
    "news24": "center", "sabc_news": "state-democratic",
    "new_frame": "left", "daily_maverick": "independent",
    "myjoyonline": "center", "ghanaweb": "center",
    "senenews": "center", "liberianot": "center",
    "nation_mw": "center", "times_zm": "center",
    "independent_rw": "center", "the_reporter_et": "center",
    "the_citizen_tz2": "center", "daily_news_tz": "center",
    "newsday_zw2": "center", "allafrica": "center",
    "the_east_african": "center", "east_african": "center",
    "daily_monitor_ug": "center",

    # Central Asia / Caucasus
    "gazeta_uz": "center", "cabar_asia": "independent",
    "tajik_times": "center", "turkmen_news": "independent",
    "astana_times": "lean-right", "kabar_kg": "state-pro",
    "eurasianet": "independent", "azertag": "state-pro",
    "azernews": "lean-right", "civil_ge": "independent",

    # Pacific
    "post_courier_pg": "center", "island_biz": "center",
    "fiji_times": "center", "rnz_pacific": "state-democratic",

    # Pan-African / international
    "rfi_fr": "state-democratic", "afrik_com": "center",
    "africa24_fr": "center",
}

# ── Geo cluster map ────────────────────────────────────────────────────────────
# Derived from country code; override where needed
GEO_BY_COUNTRY = {
    "US": "west", "GB": "west", "CA": "west", "AU": "west", "NZ": "west",
    "FR": "west", "DE": "west", "IT": "west", "ES": "west", "NL": "west",
    "BE": "west", "CH": "west", "AT": "west", "PT": "west", "GR": "west",
    "SE": "west", "NO": "west", "DK": "west", "FI": "west",
    "PL": "eastern-europe", "CZ": "eastern-europe", "HU": "eastern-europe",
    "RO": "eastern-europe", "BG": "eastern-europe", "SK": "eastern-europe",
    "HR": "eastern-europe", "SI": "eastern-europe", "RS": "eastern-europe",
    "BA": "eastern-europe", "ME": "eastern-europe", "MK": "eastern-europe",
    "AL": "eastern-europe", "XK": "eastern-europe",
    "UA": "eastern-europe", "BY": "eastern-europe",
    "EE": "eastern-europe", "LV": "eastern-europe", "LT": "eastern-europe",
    "RU": "adversarial", "CN": "adversarial", "IR": "adversarial",
    "KP": "adversarial", "SY": "adversarial",
    "IL": "middle-east", "SA": "middle-east", "AE": "middle-east",
    "QA": "middle-east", "KW": "middle-east", "BH": "middle-east",
    "OM": "middle-east", "JO": "middle-east", "LB": "middle-east",
    "EG": "middle-east", "IQ": "middle-east", "YE": "middle-east",
    "TR": "middle-east", "MA": "middle-east", "DZ": "middle-east",
    "TN": "middle-east", "LY": "middle-east",
    "IN": "global-south", "PK": "global-south", "BD": "global-south",
    "LK": "global-south", "NP": "global-south", "AF": "global-south",
    "JP": "pacific-asia", "KR": "pacific-asia", "TW": "pacific-asia",
    "HK": "pacific-asia", "MN": "pacific-asia",
    "ID": "pacific-asia", "MY": "pacific-asia", "TH": "pacific-asia",
    "VN": "pacific-asia", "PH": "pacific-asia", "SG": "pacific-asia",
    "MM": "pacific-asia", "KH": "pacific-asia", "LA": "pacific-asia",
    "BN": "pacific-asia",
    "PG": "pacific-asia", "FJ": "pacific-asia", "WS": "pacific-asia",
    "TO": "pacific-asia", "SB": "pacific-asia", "VU": "pacific-asia",
    "BR": "latin-america", "MX": "latin-america", "AR": "latin-america",
    "CO": "latin-america", "CL": "latin-america", "PE": "latin-america",
    "VE": "latin-america", "EC": "latin-america", "BO": "latin-america",
    "PY": "latin-america", "UY": "latin-america", "GY": "latin-america",
    "GT": "latin-america", "CR": "latin-america", "HN": "latin-america",
    "SV": "latin-america", "NI": "latin-america", "PA": "latin-america",
    "CU": "latin-america", "DO": "latin-america", "JM": "latin-america",
    "TT": "latin-america", "BB": "latin-america", "AG": "latin-america",
    "LC": "latin-america",
    "NG": "africa", "KE": "africa", "ZA": "africa", "ET": "africa",
    "TZ": "africa", "UG": "africa", "GH": "africa", "SN": "africa",
    "CI": "africa", "CM": "africa", "RW": "africa", "MW": "africa",
    "ZM": "africa", "ZW": "africa", "LR": "africa", "SL": "africa",
    "MZ": "africa", "AO": "africa", "SD": "africa", "SO": "africa",
    "KZ": "central-asia", "UZ": "central-asia", "TJ": "central-asia",
    "TM": "central-asia", "KG": "central-asia",
    "GE": "central-asia", "AM": "central-asia", "AZ": "central-asia",
}

# Bias → Ground News 3-bucket collapse (for coverage % calc)
def bias_to_bucket(tier: str) -> str:
    if tier in ("far-left", "left", "lean-left"):
        return "left"
    if tier in ("center", "state-democratic", "independent", "unknown"):
        return "center"
    if tier in ("lean-right", "right", "far-right"):
        return "right"
    return "center"  # state-pro, non-western → neutral for coverage calc

def main():
    with open(SOURCES_PATH) as f:
        data = json.load(f)

    sources = data["sources"]
    tagged = 0
    for s in sources:
        sid = s["id"]
        country = s.get("country", "")

        # bias_tier
        tier = BIAS.get(sid)
        if tier is None:
            cats = s.get("categories", [])
            if "state_organ" in cats:
                tier = "state-pro"
            elif "public-broadcaster" in cats or "public-radio" in cats or "public-tv" in cats:
                tier = "state-democratic"
            elif "indie" in cats or "independent" in cats or "investigative" in cats:
                tier = "independent"
            elif "osint" in cats:
                tier = "independent"
            elif "aggregator" in cats:
                tier = "center"
            else:
                tier = "unknown"

        s["bias_tier"] = tier
        s["bias_bucket"] = bias_to_bucket(tier)

        # geo_cluster
        s["geo_cluster"] = GEO_BY_COUNTRY.get(country, "global-south")
        tagged += 1

    data["_meta"]["total_sources"] = len(sources)
    data["_meta"]["bias_tagged_at"] = "2026-05-09"

    with open(SOURCES_PATH, "w") as f:
        json.dump(data, f, indent=2)

    # Stats
    from collections import Counter
    tiers = Counter(s["bias_tier"] for s in sources)
    buckets = Counter(s["bias_bucket"] for s in sources)
    print(f"Tagged {tagged} sources")
    print("\nbias_tier breakdown:")
    for t, c in sorted(tiers.items(), key=lambda x: -x[1]):
        print(f"  {t:<20} {c}")
    print("\nbias_bucket (L/C/R):")
    for b, c in sorted(buckets.items(), key=lambda x: -x[1]):
        print(f"  {b:<12} {c}")

if __name__ == "__main__":
    main()
