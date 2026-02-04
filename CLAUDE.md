# thepopebot - AI Agent Template

This document explains the thepopebot codebase for AI assistants working on this project.

## What is thepopebot?

thepopebot is a **template repository** for creating custom autonomous AI agents. It features a two-layer architecture: an Event Handler for orchestration (webhooks, Telegram chat, cron scheduling) and a Docker Agent for autonomous task execution via the Pi coding agent.

## Two-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        thepopebot Architecture                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Event Handler Layer                       │    │
│  │                  (Node.js Express Server)                    │    │
│  │                                                              │    │
│  │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │    │
│  │   │ Telegram │  │  GitHub  │  │   Cron   │  │  Claude  │   │    │
│  │   │ Webhook  │  │ Webhook  │  │Scheduler │  │   Chat   │   │    │
│  │   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │    │
│  │        │             │             │             │          │    │
│  │        └─────────────┴──────┬──────┴─────────────┘          │    │
│  │                             │                               │    │
│  │                    ┌────────▼────────┐                      │    │
│  │                    │   create-job    │                      │    │
│  │                    │  (GitHub API)   │                      │    │
│  │                    └────────┬────────┘                      │    │
│  └─────────────────────────────┼────────────────────────────────┘    │
│                                │                                     │
│                    Creates job/uuid branch                          │
│                    Updates workspace/job.md                         │
│                                │                                     │
│                                ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Docker Agent Layer                        │    │
│  │               (Pi Coding Agent Container)                    │    │
│  │                                                              │    │
│  │   ┌─────────────────────────────────────────────────────┐   │    │
│  │   │  entrypoint.sh                                      │   │    │
│  │   │  1. Clone job branch                                │   │    │
│  │   │  2. Run Pi with THEPOPEBOT.md + SOUL.md + job.md   │   │    │
│  │   │  3. Commit results                                  │   │    │
│  │   │  4. Create PR and auto-merge                        │   │    │
│  │   └─────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
/
├── auth.json                   # API credentials (Pi looks here)
├── operating_system/
│   ├── THEPOPEBOT.md           # Agent behavior instructions
│   ├── SOUL.md                 # Agent identity and personality
│   ├── EVENT_HANDLER.md        # Telegram conversational interface instructions
│   ├── HEARTBEAT.md            # Periodic check instructions
│   └── CRONS.json              # Scheduled job definitions
├── event_handler/              # Event Handler orchestration layer
│   ├── server.js               # Express HTTP server (webhooks, Telegram, GitHub)
│   ├── cron.js                 # Cron scheduler (loads CRONS.json)
│   ├── claude/
│   │   ├── index.js            # Claude API integration for chat
│   │   ├── tools.js            # Tool definitions (create_job)
│   │   └── conversation.js     # Chat history management
│   └── tools/
│       ├── create-job.js       # Job creation via GitHub API
│       ├── github.js           # GitHub REST API helper
│       └── telegram.js         # Telegram bot integration
├── MEMORY.md                   # Long-term knowledge
├── TOOLS.md                    # Available tools reference
├── Dockerfile                  # Container definition
├── entrypoint.sh               # Container startup script
└── workspace/
    ├── job.md                  # Current task description
    └── logs/                   # Session logs (UUID.jsonl)
```

## Key Files

| File | Purpose |
|------|---------|
| `auth.json` | API keys for Anthropic/OpenAI/Groq. Pi reads this via PI_CODING_AGENT_DIR |
| `operating_system/THEPOPEBOT.md` | Core behavior instructions passed to the agent at runtime |
| `operating_system/SOUL.md` | Agent personality and identity |
| `operating_system/EVENT_HANDLER.md` | Instructions for Telegram conversational interface |
| `workspace/job.md` | The specific task for the agent to execute |
| `Dockerfile` | Builds the agent container (Node.js 22, Playwright, Pi) |
| `entrypoint.sh` | Container startup script - clones repo, runs agent, commits results |

## Event Handler Layer

The Event Handler is a Node.js Express server that provides orchestration capabilities:

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/webhook` | POST | Generic webhook for job creation (requires API_KEY) |
| `/telegram/webhook` | POST | Telegram bot webhook for conversational interface |
| `/github/webhook` | POST | GitHub webhook for PR/push notifications |

### Components

- **server.js** - Express HTTP server handling all webhook routes
- **cron.js** - Loads CRONS.json and schedules jobs using node-cron
- **claude/** - Claude API integration for Telegram chat with tool use
- **tools/** - Job creation, GitHub API, and Telegram utilities

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

## Docker Agent Layer

The Dockerfile creates a container with:
- **Node.js 22** (Bookworm slim)
- **Pi coding agent** (`@mariozechner/pi-coding-agent`)
- **Playwright + Chromium** (headless browser automation)
- **Git + GitHub CLI** (for repository operations)

### Runtime Flow (entrypoint.sh)

1. Extract Job ID from branch name (job/uuid → uuid) or generate UUID
2. Start headless Chrome (CDP on port 9222)
3. Configure Git credentials via `gh auth setup-git`
4. Clone repository branch to `/job`
5. Set `PI_CODING_AGENT_DIR=/job` so Pi finds auth.json
6. Run Pi with THEPOPEBOT.md + SOUL.md + job.md as prompt
7. Save session log to `workspace/logs/{JOB_ID}/`
8. Commit all changes with message `thepopebot: job {JOB_ID}`
9. Create PR and auto-merge to main with `gh pr create` and `gh pr merge --squash`

### Environment Variables (Docker Agent)

| Variable | Description | Required |
|----------|-------------|----------|
| `REPO_URL` | Git repository URL to clone | Yes |
| `BRANCH` | Branch to clone and work on (e.g., job/uuid) | Yes |
| `GH_TOKEN` | GitHub token for gh CLI authentication | Yes |
| `PI_AUTH` | Base64-encoded auth.json contents | Yes |

## How Pi Finds Credentials

Pi coding agent looks for `auth.json` in the directory specified by `PI_CODING_AGENT_DIR`. The entrypoint sets:

```bash
export PI_CODING_AGENT_DIR=/job
```

This means `auth.json` must be at `/job/auth.json` (the repository root).

## auth.json Format

```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-xxxxx" },
  "openai": { "type": "api_key", "key": "sk-xxxxx" },
  "groq": { "type": "api_key", "key": "xxxxx" }
}
```

## Customization Points

To create your own agent:

1. **auth.json** - Add your API keys
2. **operating_system/THEPOPEBOT.md** - Modify agent behavior and rules
3. **operating_system/SOUL.md** - Customize personality and identity
4. **operating_system/EVENT_HANDLER.md** - Configure Telegram chat behavior
5. **operating_system/CRONS.json** - Define scheduled jobs
6. **workspace/job.md** - Define the task to execute

## The Operating System

These files in `operating_system/` define the agent's character and behavior:

- **THEPOPEBOT.md** - Operational instructions (what to do, how to work)
- **SOUL.md** - Personality, identity, and values (who the agent is)
- **EVENT_HANDLER.md** - Instructions for conversational Telegram interface
- **HEARTBEAT.md** - Self-monitoring behavior
- **CRONS.json** - Scheduled job definitions

Additional files at root:
- **MEMORY.md** - Persistent knowledge across sessions

## Session Logs

Each job creates a session log at `workspace/logs/{JOB_ID}/`. This directory contains the full conversation history and can be resumed for follow-up tasks via the `--session-dir` flag.
