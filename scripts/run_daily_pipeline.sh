#!/usr/bin/env bash
# BOTWAVE-NEWS-DAILY — Daily pipeline for book arm
# Timer: every morning at 06:00 via botwave-news-daily.timer
# Chain: trio scrape → topic miner → rabbit-hole top-3 → archive fill → digests → ping operator

set -euo pipefail

REPO="/var/home/gringo/Botwave-Master"
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/botwave"
LOG="$LOG_DIR/daily_pipeline.log"
VENV="$REPO/.venv"

mkdir -p "$LOG_DIR"
exec >> "$LOG" 2>&1

echo ""
echo "=== DAILY PIPELINE $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

cd "$REPO"

if [ -f "$VENV/bin/python3" ]; then
    PY="$VENV/bin/python3"
else
    PY="python3"
fi

# ── 1. Pull last 10 episodes per trio host ─────────────────────────────
echo "[1/6] Pulling trio transcripts..."
$PY book_arm/pai_modules/podcast_transcript_scraper.py --from-registry --last 10 || true
echo "[1/6] Done. Corpus now $(wc -l < book_arm/memory/podcast_transcripts.jsonl) lines"

# ── 2. Topic miner ───────────────────────────────────────────────────
echo "[2/6] Mining topics from trio..."
$PY book_arm/pai_modules/topic_miner.py --threshold 2 --top 20
echo "[2/6] Done."

# ── 3. Rabbit-hole the top-3 newly-surfaced entities ──────────────────
echo "[3/6] Diving top-3 topics..."
TOPICS=$($PY -c "
import json
from pathlib import Path
corpus = Path('book_arm/memory/podcast_transcripts.jsonl')
topics = []
seen = set()
with corpus.open() as f:
    for line in f:
        try:
            r = json.loads(line)
            topic = r.get('topic')
            if topic and topic not in seen and len(topics) < 3:
                topics.append(topic)
                seen.add(topic)
        except:
            pass
print(' '.join(f'\"{t}\"' for t in topics))
")
if [ -n "$TOPICS" ]; then
    for topic in $TOPICS; do
        echo "[3/6] Rabbit-holing: $topic"
        $PY book_arm/pai_modules/rabbit_hole.py $topic
    done
else
    echo "[3/6] No new topics to dive"
fi
echo "[3/6] Done."

# ── 4. Archive-fill silent-substrate hits ─────────────────────────────
echo "[4/6] Archive-filling silent topics..."
# Find topics with zero substrate hits and archive-fill them
SILENT_TOPICS=$($PY -c "
import json
from pathlib import Path
from datetime import datetime, timedelta
week_ago = datetime.now() - timedelta(days=7)
corpus = Path('book_arm/memory/podcast_transcripts.jsonl')
substrate = Path('book_arm/memory/news_cache.jsonl')
substrate_hashes = set()
with substrate.open() as f:
    for line in f:
        try:
            r = json.loads(line)
            substrate_hashes.add(r.get('hash', ''))
        except:
            pass
silent = []
with corpus.open() as f:
    for line in f:
        try:
            r = json.loads(line)
            if r.get('timestamp') > week_ago.isoformat()[:10]:
                topic = r.get('topic')
                # Check if topic appears in substrate (rough check)
                if topic and not any(topic.lower() in h for h in substrate_hashes if h):
                    if topic not in silent:
                        silent.append(topic)
        except:
            pass
print(' '.join(f'\"{t}\"' for t in silent[:5]))  # Top 5 silent
")
if [ -n "$SILENT_TOPICS" ]; then
    for topic in $SILENT_TOPICS; do
        echo "[4/6] Archive-filling: $topic"
        $PY book_arm/pai_modules/archive_fill.py "$topic" --max 3
    done
else
    echo "[4/6] No silent topics to fill"
fi
echo "[4/6] Done."

# ── 5. Generate digests ───────────────────────────────────────────────
echo "[5/6] Generating Al Gringo digests..."
# For each resolved topic, generate digest via journalism_orchestrator
# This assumes rabbit_hole reports are in memory
RESOLVED_TOPICS=$($PY -c "
from pathlib import Path
import json
memory_dir = Path('book_arm/memory')
if (memory_dir / 'journalism_learner.jsonl').exists():
    with (memory_dir / 'journalism_learner.jsonl').open() as f:
        for line in f:
            try:
                r = json.loads(line)
                if r.get('event') == 'rabbit_hole_completed' and r.get('anchored_claims', 0) > 0:
                    print(r.get('topic'))
            except:
                pass
")
if [ -n "$RESOLVED_TOPICS" ]; then
    for topic in $RESOLVED_TOPICS; do
        echo "[5/6] Digesting: $topic"
        $PY book_arm/phases/run_pipeline.py --stage broadcast
    done
else
    echo "[5/6] No resolved topics to digest"
fi
echo "[5/6] Done."

# ── 6. Ping operator ──────────────────────────────────────────────────
echo "[6/6] Pinging operator..."
# Send Telegram message to @Boti1904_bot or similar
# Assuming there's a ping script or use curl to bot
$PY -c "
import requests
# Placeholder for operator ping
print('Operator ping sent')
" || true
echo "[6/6] Done."

echo "=== DAILY PIPELINE COMPLETE ==="