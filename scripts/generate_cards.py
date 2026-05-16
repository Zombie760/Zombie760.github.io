#!/usr/bin/env python3
"""
generate_cards.py — BOTWAVEBOMBA story card PNG generator.

Reads latest.json, generates a 1200x630 PNG card for every story that
doesn't already have one (incremental — skips existing files). Cards land at:
    botwavebomba/api/cards/{story_id}.png

The frontend references them as fallback when a story has no article image.
"""

import json
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
LATEST_JSON = SCRIPTS_DIR.parent / "botwavebomba" / "api" / "latest.json"
CARDS_DIR   = SCRIPTS_DIR.parent / "botwavebomba" / "api" / "cards"

# Reuse card generator from blindspot_alert
sys.path.insert(0, str(SCRIPTS_DIR))
from blindspot_alert import generate_card


def main() -> None:
    if not LATEST_JSON.exists():
        print("[generate_cards] latest.json not found — skipping")
        return

    data    = json.loads(LATEST_JSON.read_text())
    stories = data.get("stories", [])

    CARDS_DIR.mkdir(parents=True, exist_ok=True)

    generated = skipped = errors = 0
    for story in stories:
        sid  = story.get("id", "")
        if not sid:
            continue
        dest = CARDS_DIR / f"{sid}.png"
        if dest.exists():
            skipped += 1
            continue
        try:
            png = generate_card(story)
            dest.write_bytes(png)
            generated += 1
        except Exception as e:
            print(f"[generate_cards] ERROR {sid}: {e}", file=sys.stderr)
            errors += 1

    print(f"[generate_cards] {generated} generated, {skipped} skipped, {errors} errors — cards at {CARDS_DIR}")


if __name__ == "__main__":
    main()
