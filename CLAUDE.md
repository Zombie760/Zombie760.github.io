# thepopebot - AI Agent Template

This document explains the thepopebot codebase for AI assistants working on this project.

## What is thepopebot?

thepopebot is a **template repository** for creating custom autonomous AI agents. It features a two-layer architecture: an Event Handler for orchestration (webhooks, Telegram chat, cron scheduling) and a Docker Agent for autonomous task execution via the Pi coding agent.

## Two-Layer Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          thepopebot Architecture                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────────┐                                                   │
│   │  Event Handler   │                                                   │
│   │  ┌────────────┐  │         1. create-job                            │
│   │  │  Telegram  │  │ ─────────────────────────►  ┌──────────────────┐ │
│   │  │   Cron     │  │                             │      GitHub      │ │
│   │  │   Chat     │  │ ◄─────────────────────────  │  (job/* branch)  │ │
│   │  └────────────┘  │   5. pr-webhook.yml calls   └────────┬─────────┘ │
│   │                  │      /github/webhook                 │           │
│   └──────────────────┘                                      │           │
│            │                                                │           │
│            │                           2. job-runner.yml    │           │
│            ▼                              triggers          │           │
│   ┌──────────────────┐                                      │           │
│   │ Telegram notifies│                                      ▼           │
│   │ user of job done │                         ┌──────────────────────┐ │
│   └──────────────────┘                         │    Docker Agent      │ │
│                                                │  ┌────────────────┐  │ │
│                                                │  │ 1. Clone       │  │ │
│                                                │  │ 2. Run Pi      │  │ │
│                                                │  │ 3. Commit      │  │ │
│                                                │  │ 4. Create PR   │  │ │
│                                                │  └────────────────┘  │ │
│                                                └──────────┬───────────┘ │
│                                                           │             │
│                                                           │ 3. PR opens │
│                                                           ▼             │
│                                                ┌──────────────────────┐ │
│                                                │       GitHub         │ │
│                                                │    (PR opened)       │ │
│                                                │                      │ │
│                                                │ 4. pr-webhook.yml    │ │
│                                                │    triggers          │ │
│                                                └──────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
/
├── .github/workflows/
│   ├── job-runner.yml          # Runs Docker agent when job/* branch created
│   └── pr-webhook.yml          # Notifies event handler when PR opened
├── .pi/
│   ├── extensions/             # Pi extensions (env-sanitizer for secret filtering)
│   └── skills/                 # Custom skills for the agent
├── docs/                       # Additional documentation
├── event_handler/              # Event Handler orchestration layer
│   ├── server.js               # Express HTTP server (webhooks, Telegram, GitHub)
│   ├── cron.js                 # Cron scheduler (loads CRONS.json)
│   ├── claude/
│   │   ├── index.js            # Claude API integration for chat
│   │   ├── tools.js            # Tool definitions (create_job, get_job_status)
│   │   └── conversation.js     # Chat history management
│   └── tools/
│       ├── create-job.js       # Job creation via GitHub API
│       ├── github.js           # GitHub REST API helper + job status
│       └── telegram.js         # Telegram bot integration
├── operating_system/
│   ├── THEPOPEBOT.md           # Agent behavior instructions
│   ├── SOUL.md                 # Agent identity and personality
│   ├── CHATBOT.md              # Telegram chat system prompt
│   ├── JOB_SUMMARY.md          # Job completion summary prompt
│   ├── HEARTBEAT.md            # Periodic check instructions
│   └── CRONS.json              # Scheduled job definitions
├── setup/                      # Interactive setup wizard
│   ├── setup.mjs               # Main wizard script
│   └── lib/                    # Helper modules
├── workspace/
│   ├── job.md                  # Current task description
│   └── logs/                   # Session logs (UUID.jsonl)
├── Dockerfile                  # Container definition
├── entrypoint.sh               # Container startup script
└── SECURITY.md                 # Security documentation
```

## Key Files

| File | Purpose |
|------|---------|
| `operating_system/THEPOPEBOT.md` | Core behavior instructions passed to the agent at runtime |
| `operating_system/SOUL.md` | Agent personality and identity |
| `operating_system/CHATBOT.md` | System prompt for Telegram chat |
| `operating_system/JOB_SUMMARY.md` | Prompt for summarizing completed jobs |
| `workspace/job.md` | The specific task for the agent to execute |
| `Dockerfile` | Builds the agent container (Node.js 22, Playwright, Pi) |
| `entrypoint.sh` | Container startup script - clones repo, runs agent, commits results |
| `.pi/extensions/env-sanitizer/` | Filters secrets from LLM's bash subprocess environment |

## Event Handler Layer

The Event Handler is a Node.js Express server that provides orchestration capabilities:

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/webhook` | POST | Generic webhook for job creation (requires API_KEY) |
| `/telegram/webhook` | POST | Telegram bot webhook for conversational interface |
| `/github/webhook` | POST | Receives notifications from GitHub Actions (pr-webhook.yml) |

### Components

- **server.js** - Express HTTP server handling all webhook routes
- **cron.js** - Loads CRONS.json and schedules jobs using node-cron
- **claude/** - Claude API integration for Telegram chat with tool use
- **tools/** - Job creation, GitHub API, and Telegram utilities

### Environment Variables (Event Handler)

| Variable | Description | Required |
|----------|-------------|----------|
| `API_KEY` | Authentication key for /webhook endpoint | Yes |
| `GH_TOKEN` | GitHub PAT for creating branches/files | Yes |
| `GH_OWNER` | GitHub repository owner | Yes |
| `GH_REPO` | GitHub repository name | Yes |
| `PORT` | Server port (default: 3000) | No |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather | For Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Secret for webhook validation | No |
| `GH_WEBHOOK_TOKEN` | Token for GitHub Actions webhook auth | For notifications |
| `ANTHROPIC_API_KEY` | Claude API key for chat functionality | For chat |
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
3. Decode `SECRETS` from base64, parse JSON, export each key as env var (filtered from LLM's bash)
4. Decode `LLM_SECRETS` from base64, parse JSON, export each key as env var (LLM can access these)
5. Configure Git credentials via `gh auth setup-git` (uses GH_TOKEN from SECRETS)
6. Clone repository branch to `/job`
7. Run Pi with THEPOPEBOT.md + SOUL.md + job.md as prompt
8. Save session log to `workspace/logs/{JOB_ID}/`
9. Commit all changes with message `thepopebot: job {JOB_ID}`
10. Create PR and auto-merge to main with `gh pr create` and `gh pr merge --squash`

### Environment Variables (Docker Agent)

| Variable | Description | Required |
|----------|-------------|----------|
| `REPO_URL` | Git repository URL to clone | Yes |
| `BRANCH` | Branch to clone and work on (e.g., job/uuid) | Yes |
| `SECRETS` | Base64-encoded JSON with protected credentials (GH_TOKEN, ANTHROPIC_API_KEY, etc.) - filtered from LLM | Yes |
| `LLM_SECRETS` | Base64-encoded JSON with credentials the LLM can access (browser logins, skill API keys) | No |

## GitHub Actions

GitHub Actions automate the job lifecycle. No manual webhook configuration needed.

### job-runner.yml

Triggers when a `job/*` branch is created. Runs the Docker agent container.

```yaml
on:
  create:
# Only runs if: branch name starts with "job/"
```

### pr-webhook.yml

Triggers when a PR is opened from a `job/*` branch. Sends a notification to the event handler so it can notify Telegram.

```yaml
on:
  pull_request:
    types: [opened]
    branches: [main]
# Only runs if: PR head branch starts with "job/"
```

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `SECRETS` | Base64-encoded JSON with protected credentials (GH_TOKEN, ANTHROPIC_API_KEY, etc.) |
| `LLM_SECRETS` | Base64-encoded JSON with LLM-accessible credentials (optional) |
| `GH_WEBHOOK_URL` | Event handler URL (e.g., `https://your-server.com`) |
| `GH_WEBHOOK_TOKEN` | Token to authenticate with event handler |

## How Credentials Work

Credentials are passed via base64-encoded JSON in the `SECRETS` environment variable:

```bash
# Encode credentials
SECRETS=$(echo -n '{"GH_TOKEN":"ghp_xxx","ANTHROPIC_API_KEY":"sk-ant-xxx"}' | base64)
```

At runtime, entrypoint.sh decodes and exports each key as a flat environment variable. The `env-sanitizer` extension filters these from the LLM's bash subprocess, so the agent can't `echo $ANTHROPIC_API_KEY`.

For credentials the LLM needs access to (browser logins, skill API keys), use `LLM_SECRETS` instead - these are NOT filtered.

## Customization Points

To create your own agent:

1. **GitHub Secrets** - Set `SECRETS` and optionally `LLM_SECRETS` with your API keys
2. **operating_system/THEPOPEBOT.md** - Modify agent behavior and rules
3. **operating_system/SOUL.md** - Customize personality and identity
4. **operating_system/CHATBOT.md** - Configure Telegram chat behavior
5. **operating_system/CRONS.json** - Define scheduled jobs
6. **workspace/job.md** - Define the task to execute
7. **.pi/skills/** - Add custom skills for the agent

## The Operating System

These files in `operating_system/` define the agent's character and behavior:

- **THEPOPEBOT.md** - Operational instructions (what to do, how to work)
- **SOUL.md** - Personality, identity, and values (who the agent is)
- **CHATBOT.md** - System prompt for Telegram chat
- **JOB_SUMMARY.md** - Prompt for summarizing completed jobs
- **HEARTBEAT.md** - Self-monitoring behavior
- **CRONS.json** - Scheduled job definitions

## Session Logs

Each job creates a session log at `workspace/logs/{JOB_ID}/`. This directory contains the full conversation history and can be resumed for follow-up tasks via the `--session-dir` flag.
