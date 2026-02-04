# thepopebot

A template repository for creating custom autonomous AI agents. Clone this repo, customize the config files, and run via Docker to execute tasks autonomously.

## Two-Layer Architecture

thepopebot features a two-layer architecture:

1. **Event Handler Layer** - Node.js Express server for webhooks, Telegram chat, and cron scheduling
2. **Docker Agent Layer** - Pi coding agent container for autonomous task execution

```
┌─────────────────────────────────────────────────────────────┐
│                     Event Handler Layer                      │
│  Telegram Webhook │ GitHub Webhook │ Cron │ Claude Chat     │
│                            ↓                                 │
│                      create-job (GitHub API)                │
└─────────────────────────────┬───────────────────────────────┘
                              │ Creates job/uuid branch
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Docker Agent Layer                       │
│  1. Clone branch → 2. Run Pi → 3. Commit → 4. PR & Merge   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Clone and Configure

```bash
# Clone the template
git clone https://github.com/yourusername/thepopebot.git my-agent
cd my-agent

# Create auth.json with your API keys
cp auth.example.json auth.json
# Edit auth.json with your Anthropic API key
```

### 2. Define Your Task

Edit `workspace/job.md`:

```markdown
# Task: Build a Landing Page

Create a responsive landing page with:
- Hero section with call-to-action
- Features grid
- Contact form
```

### 3. Push to Your Repository

```bash
git remote set-url origin https://github.com/yourusername/my-agent.git
git push -u origin main
```

### 4. Run the Agent

```bash
docker build -t my-agent .
docker run \
  -e REPO_URL=https://github.com/yourusername/my-agent.git \
  -e BRANCH=main \
  -e GH_TOKEN=ghp_xxxx \
  -e PI_AUTH=$(base64 < auth.json) \
  my-agent
```

The agent will clone your repo, execute the task, create a PR, and auto-merge the results.

## Configuration Files

### auth.json (Required)

API credentials for the AI models. Pi reads this file automatically.

```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-xxxxx" }
}
```

Supported providers: `anthropic`, `openai`, `groq`

### workspace/job.md (Required)

The task for the agent to execute. Be specific about what you want done.

### operating_system/

Agent behavior and personality configuration:
- **THEPOPEBOT.md** - Core behavioral instructions (what to do, workflow patterns)
- **SOUL.md** - Agent identity, personality traits, and values
- **EVENT_HANDLER.md** - Instructions for Telegram conversational interface
- **HEARTBEAT.md** - Self-monitoring behavior
- **CRONS.json** - Scheduled jobs (set `"enabled": true` to activate)

## File Structure

```
/
├── auth.json               # API credentials
├── operating_system/
│   ├── THEPOPEBOT.md       # Agent behavior rules
│   ├── SOUL.md             # Agent identity and personality
│   ├── EVENT_HANDLER.md    # Telegram chat instructions
│   ├── HEARTBEAT.md        # Self-monitoring
│   └── CRONS.json          # Scheduled jobs
├── event_handler/          # Event Handler orchestration layer
│   ├── server.js           # Express HTTP server
│   ├── cron.js             # Cron scheduler
│   ├── claude/             # Claude API integration
│   └── tools/              # Job creation, GitHub, Telegram utilities
├── MEMORY.md               # Persistent knowledge
├── TOOLS.md                # Available tools
├── Dockerfile              # Container definition
├── entrypoint.sh           # Startup script
└── workspace/
    ├── job.md              # Current task
    └── logs/               # Session logs
```

## Event Handler

The Event Handler is a Node.js Express server that orchestrates job creation through various triggers.

### Running the Event Handler

```bash
cd event_handler
cp .env.example .env
# Edit .env with your credentials
npm install
npm start
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/webhook` | POST | Generic webhook for job creation (requires API_KEY header) |
| `/telegram/webhook` | POST | Telegram bot webhook for conversational interface |
| `/github/webhook` | POST | GitHub webhook for PR/push notifications |

### Environment Variables (Event Handler)

| Variable | Description | Required |
|----------|-------------|----------|
| `API_KEY` | Authentication key for /webhook endpoint | Yes |
| `GITHUB_TOKEN` | GitHub PAT for creating branches/files | Yes |
| `GITHUB_OWNER` | GitHub repository owner | Yes |
| `GITHUB_REPO` | GitHub repository name | Yes |
| `PORT` | Server port (default: 3000) | No |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather | For Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Secret for webhook validation | No |
| `GITHUB_WEBHOOK_TOKEN` | Token for GitHub webhook auth | For notifications |
| `ANTHROPIC_API_KEY` | Claude API key (or use auth.json) | For chat |
| `EVENT_HANDLER_MODEL` | Claude model for chat (default: claude-sonnet-4) | No |

### Telegram Bot Setup

1. Create a bot with [@BotFather](https://t.me/botfather) on Telegram
2. Copy the bot token to `TELEGRAM_BOT_TOKEN`
3. Set your webhook URL: `https://yourserver.com/telegram/webhook`
4. Chat with your bot to create jobs via natural language

## Docker Agent

The Docker container executes tasks autonomously using the Pi coding agent.

### What's in the Container

- Node.js 22
- Pi coding agent
- Playwright + Chromium (headless browser, CDP port 9222)
- Git + GitHub CLI

### Environment Variables (Docker Agent)

| Variable | Description | Required |
|----------|-------------|----------|
| `REPO_URL` | Your repository URL | Yes |
| `BRANCH` | Branch to work on (e.g., job/uuid) | Yes |
| `GH_TOKEN` | GitHub token for gh CLI authentication | Yes |
| `PI_AUTH` | Base64-encoded auth.json contents | Yes |

### Runtime Flow

1. Extract Job ID from branch name (job/uuid → uuid) or generate UUID
2. Start Chrome in headless mode (CDP on port 9222)
3. Configure Git credentials via `gh auth setup-git`
4. Clone your repository branch to `/job`
5. Set `PI_CODING_AGENT_DIR=/job` (so Pi finds auth.json)
6. Run Pi with THEPOPEBOT.md + SOUL.md + job.md as instructions
7. Commit all changes: `thepopebot: job {UUID}`
8. Create PR and auto-merge to main
9. Clean up

## Customization

### Customize the Operating System

Edit files in `operating_system/`:
- **THEPOPEBOT.md** - Git conventions, prohibited actions, error handling, protocols
- **SOUL.md** - Identity, traits, working style, values
- **EVENT_HANDLER.md** - Telegram conversational behavior
- **CRONS.json** - Scheduled job definitions

### Define Tasks

Edit `workspace/job.md` with:
- Clear task description
- Specific requirements
- Expected outputs

## Session Logs

Each job creates a session log at `workspace/logs/{JOB_ID}/`. These can be used to resume sessions or review agent actions.
