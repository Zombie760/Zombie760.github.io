#!/usr/bin/env bash
# BOTWAVEBOMBA pipeline — ingest → generate → push
# Timer: every 6 hours via botwave-bomba-pipeline.timer
# Logs: ~/.local/state/botwave/bomba_pipeline.log

set -euo pipefail

REPO="/var/home/gringo/Botwave-Master"
STAGING="/var/home/gringo/Botwave-Master/Archive/zombie760-staging/Zombie760.github.io"
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/botwave"
LOG="$LOG_DIR/bomba_pipeline.log"
VENV="$REPO/.venv"
INGEST_TIMEOUT=1500   # 25 min hard cap on ingestor
PUSH_TIMEOUT=300      # 5 min hard cap on git push (was 2 min — GitHub Pages push often needs >2 min)

mkdir -p "$LOG_DIR"
exec >> "$LOG" 2>&1

echo ""
echo "=== BOMBA PIPELINE $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="

# ── 0. Sync staging repo BEFORE any file changes ─────────────────────────────
echo "[0/4] Syncing staging repo to origin/main..."
cd "$STAGING"
git fetch origin --quiet
git reset --hard origin/main --quiet
echo "[0/4] Staging at $(git rev-parse --short HEAD)"

# ── 1. Ingest ───────────────────────────────────────────────────────────────
cd "$REPO"
NSOURCES=$(python3 -c "import json; d=json.load(open('$REPO/book_arm/memory/sources_global.json')); print(len(d['sources']))" 2>/dev/null || echo "317")
echo "[1/4] Ingesting RSS feeds ($NSOURCES sources)..."
if [ -f "$VENV/bin/python3" ]; then
    PY="$VENV/bin/python3"
else
    PY="python3"
fi

set +e
timeout "$INGEST_TIMEOUT" $PY book_arm/pai_modules/global_ingestor.py --run
INGEST_EXIT=$?
set -e
if [ $INGEST_EXIT -eq 124 ]; then
    echo "[1/4] Ingest timed out after ${INGEST_TIMEOUT}s — using existing cache"
elif [ $INGEST_EXIT -ne 0 ]; then
    echo "[1/4] Ingest failed with exit $INGEST_EXIT — using existing cache"
fi
echo "[1/4] Done. Cache: $(wc -l < book_arm/memory/news_cache.jsonl) articles"

# ── 2. Generate feed ────────────────────────────────────────────────────────
echo "[2/4] Generating feed..."
$PY zombie760.github.io/scripts/generate_feed.py
echo "[2/4] Done."

# ── 2.5. Generate story card PNGs ───────────────────────────────────────────
echo "[2.5/4] Generating story cards..."
$PY "$REPO/zombie760.github.io/scripts/generate_cards.py" || true
echo "[2.5/4] Done."

# ── 2.6. Publish corruption ledger from substrate ──────────────────────────
# Pulls Telos/substrate/usa_corruption/claims.jsonl (same source the Discord
# bot reads) → api/corruption.json for the live dashboard.
echo "[2.6/4] Publishing corruption ledger..."
$PY "$REPO/zombie760.github.io/scripts/publish_corruption.py" || true
echo "[2.6/4] Done."

# ── 3. Sync generated assets to staging ─────────────────────────────────────
echo "[3/4] Syncing assets to staging..."
rsync -a --delete \
    "$REPO/zombie760.github.io/botwavebomba/" \
    "$STAGING/botwavebomba/"

# ── 4. Commit + push ────────────────────────────────────────────────────────
echo "[4/4] Pushing to GitHub Pages..."
cd "$STAGING"

if git diff --quiet -- botwavebomba/api/latest.json 2>/dev/null; then
    echo "[4/4] No changes in latest.json — skipping push."
    echo "=== DONE (no-op) ==="
    exit 0
fi

git add botwavebomba/
git commit -m "chore(botwavebomba): feed $(date -u +%Y-%m-%dT%H:%M:%SZ)" --quiet

# Retry push with rebase-and-retry to survive non-fast-forward races
push_success=0
for attempt in 1 2 3; do
    echo "[4/4] Push attempt $attempt/3..."
    if timeout "$PUSH_TIMEOUT" git push origin main; then
        push_success=1
        break
    fi
    echo "[4/4] Push attempt $attempt failed — pulling and retrying..."
    git pull --rebase origin main --quiet || true
    sleep $((attempt * 10))
done

if [ $push_success -eq 0 ]; then
    echo "[4/4] All push attempts failed — aborting"
    exit 1
fi

# ── 5. Alert blindspots (Telegram) ──────────────────────────────────────────
echo "[5/6] Sending blindspot alerts..."
$PY "$REPO/zombie760.github.io/scripts/blindspot_alert.py" || true
echo "[5/6] Done."

# ── 6. Broadcast new stories to Discord + X ─────────────────────────────────
echo "[6/6] Broadcasting to Discord + X..."
$PY "$REPO/tools/broadcaster.py" || true
echo "[6/6] Done."
echo "=== DONE ==="
