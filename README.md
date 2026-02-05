# thepopebot

An autonomous AI agent that lives entirely in Git.

**The repository IS the agent** - code, configuration, personality, logs, and execution history all version-controlled in one place. No external databases. No config drift. Fork the repo and you fork the entire agent with its complete history.

**GitHub Actions IS the compute** - Each job runs in an isolated Docker container on GitHub's infrastructure. Free, scalable execution - run one task or a thousand in parallel. The event handler is a lightweight orchestrator; GitHub does the heavy lifting.

**Self-evolving by design** - The agent can modify its own code, refine its behavior, update its scheduled jobs, even adjust its personality. Every change flows through a PR, fully auditable and reversible.

**Secure from the ground up** - All credentials stored in GitHub Secrets. Event handler validates every webhook with token authentication. No hardcoded secrets, no exposed keys.

## Two-Layer Architecture

thepopebot features a two-layer architecture:

1. **Event Handler Layer** - Node.js Express server for webhooks, Telegram chat, and cron scheduling
2. **Docker Agent Layer** - Pi coding agent container for autonomous task execution

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  ┌─────────────────┐         ┌─────────────────┐                     │
│  │  Event Handler  │ ──1──►  │     GitHub      │                     │
│  │  (creates job)  │         │ (job/* branch)  │                     │
│  └────────▲────────┘         └────────┬────────┘                     │
│           │                           │                              │
│           │                           2 (triggers job-runner.yml)    │
│           │                           │                              │
│           │                           ▼                              │
│           │                  ┌─────────────────┐                     │
│           │                  │  Docker Agent   │                     │
│           │                  │  (runs Pi, PRs) │                     │
│           │                  └────────┬────────┘                     │
│           │                           │                              │
│           │                           3 (creates PR)                 │
│           │                           │                              │
│           │                           ▼                              │
│           │                  ┌─────────────────┐                     │
│           │                  │     GitHub      │                     │
│           │                  │   (PR opened)   │                     │
│           │                  └────────┬────────┘                     │
│           │                           │                              │
│           │                           4 (triggers pr-webhook.yml)    │
│           │                           │                              │
│           5 (Telegram notification)   │                              │
│           └───────────────────────────┘                              │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Installation

### Quick Start

**1. Create your own copy:**

[![Use this template](https://img.shields.io/badge/Use%20this%20template-238636?style=for-the-badge&logo=github)](https://github.com/stephengpope/thepopebot/generate)

Or fork: https://github.com/stephengpope/thepopebot/fork

**2. Clone and run setup:**

```bash
git clone https://github.com/YOUR_USERNAME/thepopebot.git
cd thepopebot
npm run setup
```

The wizard handles everything:
1. Checks prerequisites (Node.js 18+, gh CLI, ngrok)
2. Creates a GitHub Personal Access Token
3. Collects API keys (Anthropic required, OpenAI/Groq optional)
4. Generates `event_handler/.env` for local development
5. Sets all GitHub repository secrets (`SECRETS`, `LLM_SECRETS`, etc.)
6. Sets up Telegram bot
7. Walks you through starting the server + ngrok
8. Registers webhooks automatically

After setup, message your Telegram bot to create jobs!

### Prerequisites

- **Node.js 18+** - [nodejs.org](https://nodejs.org)
- **GitHub CLI** - `brew install gh` or [cli.github.com](https://cli.github.com)
- **ngrok** - `brew install ngrok/ngrok/ngrok` or [ngrok.com](https://ngrok.com)

### GitHub Secrets (set automatically by wizard)

| Secret | Description |
|--------|-------------|
| `SECRETS` | Base64-encoded JSON with protected credentials (see below) |
| `LLM_SECRETS` | Base64-encoded JSON with LLM-accessible credentials (optional) |
| `GH_WEBHOOK_URL` | Your ngrok URL |
| `GH_WEBHOOK_TOKEN` | Random token for webhook authentication |

The `SECRETS` secret is a base64-encoded JSON object containing all credentials:

```json
{
  "GH_TOKEN": "ghp_xxx",
  "ANTHROPIC_API_KEY": "sk-ant-xxx",
  "OPENAI_API_KEY": "sk-xxx"
}
```

Encode with: `echo -n '{"GH_TOKEN":"...","ANTHROPIC_API_KEY":"..."}' | base64`

At runtime, the entrypoint decodes and parses this JSON, exporting each key as an environment variable.

## Configuration Files

### workspace/job.md (Required)

The task for the agent to execute. Be specific about what you want done.

### operating_system/

Agent behavior and personality configuration:
- **THEPOPEBOT.md** - Core behavioral instructions (what to do, workflow patterns)
- **SOUL.md** - Agent identity, personality traits, and values
- **CHATBOT.md** - System prompt for Telegram chat
- **JOB_SUMMARY.md** - Prompt for summarizing completed jobs
- **HEARTBEAT.md** - Self-monitoring behavior
- **CRONS.json** - Scheduled jobs (set `"enabled": true` to activate)

## File Structure

```
/
├── .github/workflows/
│   ├── job-runner.yml      # Runs Docker agent on job/* branch creation
│   └── pr-webhook.yml      # Notifies event handler on PR opened
├── .pi/
│   ├── extensions/         # Pi extensions (env-sanitizer for secret filtering)
│   └── skills/             # Custom skills for the agent
├── docs/                   # Additional documentation
├── event_handler/          # Event Handler orchestration layer
│   ├── server.js           # Express HTTP server
│   ├── cron.js             # Cron scheduler
│   ├── .env                # Environment config (generated by setup)
│   ├── claude/             # Claude API integration
│   └── tools/              # Job creation, GitHub, Telegram utilities
├── operating_system/
│   ├── THEPOPEBOT.md       # Agent behavior rules
│   ├── SOUL.md             # Agent identity and personality
│   ├── CHATBOT.md          # Telegram chat system prompt
│   ├── JOB_SUMMARY.md      # Job summary prompt
│   ├── HEARTBEAT.md        # Self-monitoring
│   └── CRONS.json          # Scheduled jobs
├── setup/                  # Interactive setup wizard
│   ├── setup.mjs           # Main wizard script
│   └── lib/                # Helper modules
├── workspace/
│   ├── job.md              # Current task
│   └── logs/               # Session logs
├── Dockerfile              # Container definition
├── entrypoint.sh           # Startup script
└── SECURITY.md             # Security documentation
```

## Event Handler

The Event Handler is a Node.js Express server that orchestrates job creation through various triggers.

### Running the Event Handler

The setup wizard creates `.env` automatically. To start manually:

```bash
cd event_handler
npm install
npm start
```

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/webhook` | POST | Generic webhook for job creation (requires API_KEY header) |
| `/telegram/webhook` | POST | Telegram bot webhook for conversational interface |
| `/github/webhook` | POST | Receives notifications from GitHub Actions (pr-webhook.yml) |

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

### Telegram Bot Setup

The setup wizard handles Telegram configuration automatically. You just need to:

1. Create a bot with [@BotFather](https://t.me/botfather) on Telegram
2. Have the bot token ready when running `npm run setup`

The wizard will register the webhook and configure everything else.

## Docker Agent

The Docker container executes tasks autonomously using the Pi coding agent.

### What's in the Container

- Node.js 22
- Pi coding agent
- Puppeteer + Chromium (headless browser, CDP port 9222)
- Git + GitHub CLI

### Environment Variables (Docker Agent)

| Variable | Description | Required |
|----------|-------------|----------|
| `REPO_URL` | Your repository URL | Yes |
| `BRANCH` | Branch to work on (e.g., job/uuid) | Yes |
| `SECRETS` | Base64-encoded JSON with protected credentials (GH_TOKEN, ANTHROPIC_API_KEY, etc.) - filtered from LLM | Yes |
| `LLM_SECRETS` | Base64-encoded JSON with credentials the LLM can access (browser logins, skill API keys, etc.) | No |

### Runtime Flow

1. Extract Job ID from branch name (job/uuid → uuid) or generate UUID
2. Start Chrome in headless mode (CDP on port 9222)
3. Decode `SECRETS` from base64, parse JSON, export each key as env var (filtered from LLM's bash)
4. Decode `LLM_SECRETS` from base64, parse JSON, export each key as env var (LLM can access these)
5. Configure Git credentials via `gh auth setup-git` (uses GH_TOKEN from step 3)
5. Clone your repository branch to `/job`
6. Run Pi with THEPOPEBOT.md + SOUL.md + job.md as instructions
7. Commit all changes: `thepopebot: job {UUID}`
8. Create PR and auto-merge to main
9. Clean up

## GitHub Actions

GitHub Actions automate the entire job lifecycle. No manual webhook configuration needed in GitHub settings.

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `job-runner.yml` | `job/*` branch created | Runs Docker agent container |
| `pr-webhook.yml` | PR opened from `job/*` branch | Notifies event handler → Telegram |

### How It Works

1. Event handler (or Telegram chat) creates a `job/uuid` branch via GitHub API
2. GitHub Actions detects branch creation → runs `job-runner.yml`
3. Docker agent executes task, commits results, creates PR
4. GitHub Actions detects PR opened → runs `pr-webhook.yml`
5. Event handler receives notification → sends Telegram message with job status

## Customization

### Customize the Operating System

Edit files in `operating_system/`:
- **THEPOPEBOT.md** - Git conventions, prohibited actions, error handling, protocols
- **SOUL.md** - Identity, traits, working style, values
- **CHATBOT.md** - Telegram conversational behavior
- **HEARTBEAT.md** - Periodic self-check behavior
- **CRONS.json** - Scheduled job definitions

### Define Tasks

Edit `workspace/job.md` with:
- Clear task description
- Specific requirements
- Expected outputs

## Session Logs

Each job creates a session log at `workspace/logs/{JOB_ID}/`. These can be used to resume sessions or review agent actions.

## Security

### Secrets Protection

The agent runs with access to sensitive credentials (API keys, GitHub tokens). The `env-sanitizer` extension in `.pi/extensions/` protects these from being leaked by the AI agent.

**How It Works:**

1. GitHub passes a single `SECRETS` env var (base64-encoded JSON with all credentials)
2. The entrypoint decodes and parses the JSON, exports each key as a flat env var
3. Pi starts - SDKs read their env vars (ANTHROPIC_API_KEY, gh CLI uses GH_TOKEN)
4. The extension's `spawnHook` filters ALL secret keys from bash subprocess env
5. The LLM can't `echo $ANYTHING` - subprocess env is filtered
6. Other extensions still have full `process.env` access

**What's Protected:**

| Attack Vector | Protection |
|---------------|------------|
| `echo $ANTHROPIC_API_KEY` | Filtered from bash subprocess environment |
| `echo $GH_TOKEN` | Filtered from bash subprocess environment |
| `echo $SECRETS` | Filtered from bash subprocess environment |
| `echo $ANY_CUSTOM_SECRET` | Filtered (any key in SECRETS JSON) |

### LLM-Accessible Secrets

Sometimes you want the LLM to have access to certain credentials - browser logins, skill API keys, or service passwords that skills need to use. Use `LLM_SECRETS` for these.

**How It Works:**

1. `LLM_SECRETS` is a separate base64-encoded JSON (same format as `SECRETS`)
2. The entrypoint decodes and exports each key as an env var
3. These keys are **NOT** filtered by the env-sanitizer extension
4. The LLM can access them via `echo $KEY_NAME` in bash

**Example:**

```bash
# Credentials the LLM should NOT access (filtered)
SECRETS=$(echo -n '{"GH_TOKEN":"ghp_xxx","ANTHROPIC_API_KEY":"sk-ant-xxx"}' | base64)

# Credentials the LLM CAN access (not filtered)
LLM_SECRETS=$(echo -n '{"BROWSER_PASSWORD":"mypass123","SOME_API_KEY":"key_for_skill"}' | base64)

docker run --rm -e SECRETS="$SECRETS" -e LLM_SECRETS="$LLM_SECRETS" thepopebot:latest
```

**Use Cases:**

| Credential Type | Put In | Why |
|-----------------|--------|-----|
| `GH_TOKEN` | `SECRETS` | Agent shouldn't push to arbitrary repos |
| `ANTHROPIC_API_KEY` | `SECRETS` | Agent shouldn't leak billing keys |
| Browser login password | `LLM_SECRETS` | Skills may need to authenticate |
| Third-party API key for a skill | `LLM_SECRETS` | Skills need these to function |

### Env-Sanitizer Implementation

The extension dynamically reads the `SECRETS` JSON to determine which keys to filter:

```typescript
const bashTool = createBashTool(process.cwd(), {
  spawnHook: ({ command, cwd, env }) => {
    const filteredEnv = { ...env };
    // Filter all keys defined in SECRETS JSON
    if (process.env.SECRETS) {
      try {
        for (const key of Object.keys(JSON.parse(process.env.SECRETS))) {
          delete filteredEnv[key];
        }
      } catch {}
    }
    delete filteredEnv.SECRETS;
    return { command, cwd, env: filteredEnv };
  },
});
```

**No special Docker flags required.** Works on any host.

### Security Testing

```bash
# Build and run
# Mac users (Apple Silicon): use --platform linux/amd64 for local testing
docker build --platform linux/amd64 -t thepopebot:test .

# Create base64-encoded SECRETS
SECRETS=$(echo -n '{"GH_TOKEN":"ghp_test","ANTHROPIC_API_KEY":"sk-ant-test"}' | base64)
docker run --rm -e SECRETS="$SECRETS" thepopebot:test

# Agent should NOT be able to echo any of these vars
# But Pi SDK and gh CLI should work (they read from process.env)
```

### Custom Extensions

The env-sanitizer protects against the **AI agent** accessing secrets through bash commands. It does NOT restrict extension code itself.

**If you write custom extensions:**

- Extension code runs in the same Node.js process as Pi
- Your extension CAN access `process.env` directly if needed
- This is by design - you control what your extensions do
- Only the AI agent's bash subprocess calls are filtered

**Best practices for custom extensions:**
- Don't create tools that echo environment variables to the agent
- Review extension code before adding to your agent
