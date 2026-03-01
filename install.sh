#!/bin/bash
# install-botwave.sh — One-click Botwave stack installer
# Supports: Kali, Ubuntu 22+, Debian 12+, Raspberry Pi OS
# Usage: curl -sSL https://botwave.app/install.sh | bash
# Or:    bash install-botwave.sh
set -euo pipefail

VERSION="1.0.0"
OPENCLAW_DIR="$HOME/.openclaw"
SCRIPTS_DIR="$OPENCLAW_DIR/scripts"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
step() { echo -e "\n${CYAN}${BOLD}[$1/$TOTAL] $2${NC}"; }

TOTAL=8

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  BOTWAVE INSTALLER v$VERSION                            ║"
echo "║  Self-Hosted AI Agent Fleet — One Command Setup      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
  . /etc/os-release
  log "Detected: $PRETTY_NAME"
else
  warn "Unknown OS — proceeding anyway"
fi

# Detect architecture
ARCH=$(uname -m)
log "Architecture: $ARCH"

# ── Step 1: System dependencies ──
step 1 "Installing system dependencies"
if command -v apt-get &>/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq curl wget git jq build-essential 2>/dev/null
  log "System deps installed (apt)"
elif command -v dnf &>/dev/null; then
  sudo dnf install -y -q curl wget git jq gcc make 2>/dev/null
  log "System deps installed (dnf)"
else
  warn "Package manager not detected — ensure curl, git, jq are installed"
fi

# ── Step 2: Node.js ──
step 2 "Checking Node.js"
if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  log "Node.js already installed ($NODE_VER)"
else
  log "Installing Node.js 22 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - 2>/dev/null
  sudo apt-get install -y -qq nodejs 2>/dev/null
  log "Node.js $(node -v) installed"
fi

# ── Step 3: OpenClaw ──
step 3 "Installing OpenClaw"
if command -v openclaw &>/dev/null; then
  log "OpenClaw already installed ($(openclaw --version 2>/dev/null || echo 'unknown'))"
else
  npm install -g openclaw 2>/dev/null || {
    warn "Global install failed, trying local"
    mkdir -p "$OPENCLAW_DIR"
    cd "$OPENCLAW_DIR" && npm init -y >/dev/null 2>&1 && npm install openclaw 2>/dev/null
  }
  log "OpenClaw installed"
fi

# ── Step 4: Directory structure ──
step 4 "Setting up directory structure"
mkdir -p "$OPENCLAW_DIR"/{agents,scripts/{admin,pentest,marketing},workspace}
mkdir -p "$HOME/opsec"
touch "$HOME/opsec/.auth" && chmod 600 "$HOME/opsec/.auth"
log "Directory structure created"

# ── Step 5: LM Studio (desktop only, skip on Pi) ──
step 5 "Local model server"
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "armv7l" ]; then
  log "ARM detected — installing llama.cpp server instead of LM Studio"
  if ! command -v llama-server &>/dev/null; then
    warn "Install llama.cpp manually: https://github.com/ggerganov/llama.cpp"
  fi
else
  if command -v lms &>/dev/null; then
    log "LM Studio already installed"
  else
    warn "LM Studio not found — download from https://lmstudio.ai"
    warn "After install, load a model and start the server on port 1234"
  fi
fi

# ── Step 6: Tailscale ──
step 6 "Checking Tailscale"
if command -v tailscale &>/dev/null; then
  log "Tailscale already installed"
  TS_STATUS=$(tailscale status --json 2>/dev/null | jq -r '.BackendState' 2>/dev/null || echo "unknown")
  log "Tailscale status: $TS_STATUS"
else
  log "Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | sh 2>/dev/null || warn "Tailscale install failed — install manually"
  log "Tailscale installed. Run: sudo tailscale up"
fi

# ── Step 7: Starter agent fleet ──
step 7 "Deploying starter agent fleet"
if [ ! -f "$OPENCLAW_DIR/openclaw.json" ]; then
  cat > "$OPENCLAW_DIR/openclaw.json" << 'CONFIGJSON'
{
  "version": "1.0.0",
  "agents": {
    "defaults": {
      "model": {
        "primary": "lmstudio/qwen2.5-7b-instruct",
        "fallback": "groq/llama-3.3-70b-versatile"
      }
    },
    "list": [
      {"id": "captain", "name": "Captain", "role": "Fleet coordinator — routes tasks to agents"},
      {"id": "scout", "name": "Scout", "role": "Research agent — web scraping, competitive intel"},
      {"id": "scribe", "name": "Scribe", "role": "Documentation — changelogs, reports, summaries"},
      {"id": "ghost", "name": "Ghost", "role": "Silent watcher — monitoring, alerts, anomalies"},
      {"id": "contentbot", "name": "ContentBot", "role": "Social media content generation"}
    ]
  },
  "models": {
    "providers": {
      "lmstudio": {"baseUrl": "http://127.0.0.1:1234/v1", "models": [{"id": "qwen2.5-7b-instruct", "name": "Qwen 2.5 7B"}]},
      "groq": {"baseUrl": "https://api.groq.com/openai/v1", "models": [{"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B"}]},
      "cerebras": {"baseUrl": "https://api.cerebras.ai/v1", "models": [{"id": "llama3.1-8b", "name": "Llama 3.1 8B"}]}
    }
  },
  "channels": {
    "telegram": {
      "enabled": false,
      "token": "YOUR_BOT_TOKEN_HERE"
    }
  }
}
CONFIGJSON
  log "Starter fleet config created (5 agents)"
else
  log "Config already exists — skipping"
fi

# ── Step 8: Desktop shortcut (Linux only) ──
step 8 "Creating desktop shortcut"
if [ -d "$HOME/Desktop" ]; then
  cat > "$HOME/Desktop/botwave.desktop" << DESKTOPEOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Botwave Desktop
Comment=AI Agent Fleet Commander
Exec=npx electron $HOME/botwave-desktop
Icon=$HOME/botwave-desktop/public/icon.png
Terminal=false
Categories=Utility;Development;
DESKTOPEOF
  chmod +x "$HOME/Desktop/botwave.desktop" 2>/dev/null || true
  log "Desktop shortcut created"
else
  warn "No Desktop directory found — skipping shortcut"
fi

# ── Summary ──
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  BOTWAVE INSTALLATION COMPLETE                           ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  Config:    ~/.openclaw/openclaw.json                    ║"
echo "║  Scripts:   ~/.openclaw/scripts/                         ║"
echo "║  Agents:    5 starter agents configured                  ║"
echo "║                                                          ║"
echo "║  NEXT STEPS:                                             ║"
echo "║  1. Add your Telegram bot token to openclaw.json         ║"
echo "║  2. Add API keys (Groq, etc.) to openclaw.json           ║"
echo "║  3. Start LM Studio and load a model                     ║"
echo "║  4. Run: openclaw start                                  ║"
echo "║  5. Message your bot on Telegram                         ║"
echo "║                                                          ║"
echo "║  Desktop app: cd ~/botwave-desktop && npx electron .     ║"
echo "║  Docs: https://botwave.app/self-host.html               ║"
echo "╚══════════════════════════════════════════════════════════╝"
