#!/usr/bin/env python3
"""
blindspot_alert.py — BOTWAVEBOMBA blindspot Telegram notifier.

Reads latest.json, filters stories where is_blindspot == True AND
blindspot_score >= 8.0, generates a PNG card per story, sends via
Telegram sendPhoto to CHANNEL, and records sent IDs in a state file
so repeats never fire.

Usage:
    python3 blindspot_alert.py          # live mode
    python3 blindspot_alert.py --dry-run  # print messages, no Telegram calls
"""

import io
import json
import re
import sys
import uuid
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────
LATEST_JSON   = Path("/var/home/gringo/Botwave-Master/zombie760.github.io/botwavebomba/api/latest.json")
ENV_MASTER    = Path("~/.botwave/.env.master").expanduser()
STATE_DIR     = Path("~/.local/state/botwave").expanduser()
STATE_FILE    = STATE_DIR / "blindspot_alert_sent.json"
CHANNEL       = "@sgk1904"
SCORE_FLOOR   = 8.0
MAX_PER_RUN   = 5
STORY_BASE    = "https://zombie760.github.io/botwavebomba/story.html"

FONT_BOLD     = Path("/usr/share/fonts/liberation-mono-fonts/LiberationMono-Bold.ttf")
FONT_REG      = Path("/usr/share/fonts/liberation-mono-fonts/LiberationMono-Regular.ttf")

# Card dimensions (standard OG / Telegram photo)
CARD_W, CARD_H = 1200, 630


# ── Token extraction ─────────────────────────────────────────────────────────
def load_token(env_path: Path) -> str | None:
    if not env_path.exists():
        print(f"[blindspot_alert] WARNING: {env_path} not found — skipping alerts", file=sys.stderr)
        return None
    raw = env_path.read_text(errors="replace")
    m = re.search(r'(?:^|export\s+)TELEGRAM_NEWS_BOT_TOKEN=["\']?([^"\'#\s]+)', raw, re.MULTILINE)
    if not m:
        print("[blindspot_alert] WARNING: TELEGRAM_NEWS_BOT_TOKEN not found in .env.master — skipping alerts", file=sys.stderr)
        return None
    return m.group(1)


# ── State management ─────────────────────────────────────────────────────────
def load_sent_ids() -> set:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    if not STATE_FILE.exists():
        return set()
    try:
        data = json.loads(STATE_FILE.read_text())
        return set(data.get("sent_ids", []))
    except (json.JSONDecodeError, OSError):
        return set()


def save_sent_ids(sent: set) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({"sent_ids": sorted(sent)}, indent=2))


# ── Bloc helpers ─────────────────────────────────────────────────────────────
def bloc_counts(sources: list) -> tuple[int, int, int]:
    western = neutral = adversarial = 0
    for src in sources:
        b = src.get("bloc", "")
        if b == "western":
            western += 1
        elif b == "neutral":
            neutral += 1
        elif b == "adversarial":
            adversarial += 1
    return western, neutral, adversarial


# ── Card generator ────────────────────────────────────────────────────────────
def _wrap_text(draw, text: str, font, max_width: int) -> list[str]:
    words = text.split()
    lines, current = [], ""
    for word in words:
        test = (current + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] > max_width and current:
            lines.append(current)
            current = word
        else:
            current = test
    if current:
        lines.append(current)
    return lines


def generate_card(story: dict) -> bytes:
    from PIL import Image, ImageDraw, ImageFont

    BG            = (10, 10, 10)
    WHITE         = (255, 255, 255)
    RED           = (220, 38, 38)
    MUTED         = (100, 100, 100)
    DIVIDER       = (35, 35, 35)
    BLUE          = (37, 99, 235)
    TEAL          = (20, 148, 148)

    img  = Image.new("RGB", (CARD_W, CARD_H), BG)
    draw = ImageDraw.Draw(img)

    bold_path = str(FONT_BOLD) if FONT_BOLD.exists() else None
    reg_path  = str(FONT_REG)  if FONT_REG.exists()  else None

    def _font(path, size):
        try:
            return ImageFont.truetype(path, size) if path else ImageFont.load_default()
        except OSError:
            return ImageFont.load_default()

    f_brand    = _font(reg_path,  20)
    f_badge    = _font(bold_path, 26)
    f_headline = _font(bold_path, 46)
    f_stats    = _font(bold_path, 28)
    f_url      = _font(reg_path,  20)

    PAD = 60

    # Branding
    draw.text((PAD, 36), "BOTWAVEBOMBA", font=f_brand, fill=MUTED)

    # Badge
    badge_text  = "BLINDSPOT DETECTED"
    badge_bbox  = draw.textbbox((0, 0), badge_text, font=f_badge)
    badge_w     = badge_bbox[2] - badge_bbox[0] + 32
    badge_h     = badge_bbox[3] - badge_bbox[1] + 16
    draw.rectangle([PAD, 74, PAD + badge_w, 74 + badge_h], fill=RED)
    draw.text((PAD + 16, 74 + 8), badge_text, font=f_badge, fill=WHITE)

    # Headline
    headline   = story.get("headline", "").strip()
    hl_top     = 74 + badge_h + 28
    max_hl_w   = CARD_W - PAD * 2
    lines      = _wrap_text(draw, headline, f_headline, max_hl_w)
    lines      = lines[:4]
    if len(lines) == 4:
        last = lines[3]
        while last and draw.textbbox((0, 0), last + "…", font=f_headline)[2] > max_hl_w:
            last = last.rsplit(" ", 1)[0]
        lines[3] = last + "…"

    line_h = 58
    for i, line in enumerate(lines):
        draw.text((PAD, hl_top + i * line_h), line, font=f_headline, fill=WHITE)

    # Divider
    div_y = CARD_H - 130
    draw.rectangle([PAD, div_y, CARD_W - PAD, div_y + 1], fill=DIVIDER)

    # Stats
    sources      = story.get("sources", [])
    score        = float(story.get("blindspot_score", 0))
    variance     = float(story.get("bias_variance", 0.0))
    source_count = len(sources)
    western, neutral, adversarial = bloc_counts(sources)

    stats_y = div_y + 18
    draw.text((PAD,       stats_y), f"SCORE {score:.0f}",     font=f_stats, fill=RED)
    draw.text((PAD + 210, stats_y), f"SOURCES {source_count}", font=f_stats, fill=WHITE)
    draw.text((PAD + 460, stats_y), f"VAR {variance:.1f}",    font=f_stats, fill=MUTED)

    # Bloc row
    bloc_y = stats_y + 46
    x = PAD
    for count, label, color in [
        (western,     "W", BLUE),
        (neutral,     "N", TEAL),
        (adversarial, "A", RED),
    ]:
        c = color if count else MUTED
        draw.text((x, bloc_y), f"{count}{label}", font=f_stats, fill=c)
        x += draw.textbbox((0, 0), f"{count}{label}", font=f_stats)[2] + 24
        if label != "A":
            draw.text((x - 12, bloc_y), "/", font=f_stats, fill=MUTED)

    # Story URL (bottom right)
    story_id  = story.get("id", "")
    url_short = f"botwavebomba/{story_id[:12]}"
    url_bbox  = draw.textbbox((0, 0), url_short, font=f_url)
    url_w     = url_bbox[2] - url_bbox[0]
    draw.text((CARD_W - PAD - url_w, bloc_y + 4), url_short, font=f_url, fill=MUTED)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ── Caption builder ───────────────────────────────────────────────────────────
def build_caption(story: dict) -> str:
    sources      = story.get("sources", [])
    source_count = len(sources)
    western, neutral, adversarial = bloc_counts(sources)
    score        = story.get("blindspot_score", 0)
    variance     = story.get("bias_variance", 0.0)
    headline     = story.get("headline", "").strip()
    story_id     = story["id"]
    story_url    = f"{STORY_BASE}?id={story_id}"

    return (
        f"<b>BLINDSPOT DETECTED</b>\n"
        f"\n"
        f"<b>{headline}</b>\n"
        f"\n"
        f"Score: {float(score):.1f} | Sources: {source_count} | Variance: {float(variance):.1f}\n"
        f"Blocs: {western}W / {neutral}N / {adversarial}A\n"
        f"\n"
        f"{story_url}"
    )


# ── Telegram send ─────────────────────────────────────────────────────────────
def _multipart(fields: dict, file_name: str, file_data: bytes) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    body = b""
    for name, value in fields.items():
        body += (
            f"--{boundary}\r\n"
            f"Content-Disposition: form-data; name=\"{name}\"\r\n\r\n"
            f"{value}\r\n"
        ).encode()
    body += (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"photo\"; filename=\"{file_name}\"\r\n"
        f"Content-Type: image/png\r\n\r\n"
    ).encode()
    body += file_data + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def send_telegram(token: str, story: dict, story_id: str) -> bool:
    caption = build_caption(story)

    try:
        png = generate_card(story)
    except Exception as e:
        print(f"[blindspot_alert] WARNING: card gen failed for {story_id}: {e} — falling back to text", file=sys.stderr)
        png = None

    if png is not None:
        api_url = f"https://api.telegram.org/bot{token}/sendPhoto"
        body, content_type = _multipart(
            {"chat_id": CHANNEL, "caption": caption, "parse_mode": "HTML"},
            "card.png",
            png,
        )
        req = urllib.request.Request(api_url, data=body, headers={"Content-Type": content_type})
    else:
        api_url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = json.dumps({
            "chat_id": CHANNEL,
            "text": caption,
            "parse_mode": "HTML",
            "disable_web_page_preview": False,
        }).encode()
        req = urllib.request.Request(api_url, data=payload, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            if not result.get("ok"):
                print(f"[blindspot_alert] ERROR story={story_id}: Telegram returned ok=false", file=sys.stderr)
                return False
            return True
    except urllib.error.HTTPError as e:
        body_err = e.read()
        print(f"[blindspot_alert] ERROR story={story_id}: HTTP {e.code} — {body_err.decode()[:300]}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"[blindspot_alert] ERROR story={story_id}: {e}", file=sys.stderr)
        return False


# ── Main ─────────────────────────────────────────────────────────────────────
def main() -> None:
    dry_run = "--dry-run" in sys.argv

    if not LATEST_JSON.exists():
        return

    try:
        data = json.loads(LATEST_JSON.read_text())
    except (json.JSONDecodeError, OSError) as e:
        print(f"[blindspot_alert] ERROR reading latest.json: {e}", file=sys.stderr)
        return

    stories = data.get("stories", [])

    candidates = [
        s for s in stories
        if s.get("is_blindspot") is True and float(s.get("blindspot_score", 0)) >= SCORE_FLOOR
    ]

    if not candidates:
        print(f"[blindspot_alert] No blindspot stories with score >= {SCORE_FLOOR:.1f}.")
        return

    sent_ids   = load_sent_ids()
    new_stories = [s for s in candidates if s["id"] not in sent_ids]

    if not new_stories:
        print(f"[blindspot_alert] {len(candidates)} blindspot(s) found, all already alerted.")
        return

    new_stories.sort(key=lambda s: float(s.get("blindspot_score", 0)), reverse=True)
    batch   = new_stories[:MAX_PER_RUN]
    skipped = len(new_stories) - len(batch)

    print(
        f"[blindspot_alert] {len(new_stories)} new blindspot(s) found — alerting top {len(batch)}"
        + (f", {skipped} deferred to next run." if skipped else ".")
    )

    token = None
    if not dry_run:
        token = load_token(ENV_MASTER)
        if token is None:
            return

    newly_sent = set()
    for story in batch:
        story_id = story["id"]

        if dry_run:
            caption = build_caption(story)
            print(f"\n{'─'*60}")
            print(f"[DRY-RUN] Would send card + caption for story_id={story_id}:")
            print(caption)
        else:
            success = send_telegram(token, story, story_id)
            if success:
                print(f"[blindspot_alert] Sent alert for story_id={story_id}")
                newly_sent.add(story_id)

    if not dry_run and newly_sent:
        updated = sent_ids | newly_sent
        save_sent_ids(updated)
        print(f"[blindspot_alert] State updated — {len(updated)} total sent IDs on record.")

    if dry_run:
        print(f"\n{'─'*60}")
        print(f"[DRY-RUN] {len(batch)} card(s) would be sent ({skipped} deferred). State file not modified.")


if __name__ == "__main__":
    main()
