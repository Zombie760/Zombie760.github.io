# thepopebot - AI Agent Template

This document explains the thepopebot codebase for AI assistants working on this project.

## What is thepopebot?

thepopebot is a **template repository** for creating custom autonomous AI agents. Users clone this repo, customize the configuration files (auth.json, nervous_system/, job.md), and run via Docker. The Docker container executes tasks autonomously using the Pi coding agent.

## Architecture Overview

```
Template Flow:
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Clone thepopebot│ ──► │   Customize     │ ──► │  Push to Your   │
│    Template     │     │  Config Files   │     │    Repository   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Agent Commits  │ ◄── │   Agent Runs    │ ◄── │  Docker Clones  │
│    Results      │     │   Your Task     │     │   YOUR Repo     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Directory Structure

When running in Docker, the repository is cloned to `/job`:

```
/job/                       # Cloned repository root (PI_CODING_AGENT_DIR)
├── auth.json               # API credentials (Pi looks here)
├── nervous_system/
│   ├── AGENTS.md           # Agent behavior instructions
│   ├── PERSONALITY.md      # Agent personality traits
│   ├── HEARTBEAT.md        # Periodic check instructions
│   └── CRONS.json          # Scheduled job definitions
├── MEMORY.md               # Long-term knowledge
├── TOOLS.md                # Available tools reference
├── MERGE_JOB.md            # Post-job merge instructions
├── roles/
│   ├── orchestrator.md     # Orchestrator role behavior
│   └── worker.md           # Worker role behavior
└── workspace/
    ├── job.md              # Current task description
    └── logs/               # Session logs (UUID.jsonl)
```

## Key Files

| File | Purpose |
|------|---------|
| `auth.json` | API keys for Anthropic/OpenAI/Groq. Pi reads this via PI_CODING_AGENT_DIR |
| `nervous_system/AGENTS.md` | Core instructions passed to the agent at runtime |
| `workspace/job.md` | The specific task for the agent to execute |
| `Dockerfile` | Builds the agent container (Node.js 22, Playwright, Pi) |
| `entrypoint.sh` | Container startup script - clones repo, runs agent, commits results |
| `MERGE_JOB.md` | Instructions for post-job merge operations |

## Docker Infrastructure

The Dockerfile creates a container with:
- **Node.js 22** (Bookworm slim)
- **Pi coding agent** (`@mariozechner/pi-coding-agent`)
- **Playwright + Chromium** (headless browser automation)
- **Git + GitHub CLI** (for repository operations)

## Runtime Flow (entrypoint.sh)

1. Generate unique Job ID (UUID)
2. Start headless Chrome (CDP on port 9222)
3. Configure Git credentials (if GITHUB_TOKEN provided)
4. Clone repository to `/job` (if REPO_URL provided)
5. Set `PI_CODING_AGENT_DIR=/job` so Pi finds auth.json
6. Run Pi with nervous_system/AGENTS.md + job.md as prompt
7. Save session log as `{JOB_ID}.jsonl`
8. Commit all changes with message `thepopebot: job {JOB_ID}`
9. Optionally run merge job (if MERGE_JOB.md exists)
10. Clean up logs, commit "done."

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REPO_URL` | Git repository URL to clone | Yes (for remote repos) |
| `BRANCH` | Branch to clone and work on | Yes |
| `GITHUB_TOKEN` | GitHub Personal Access Token for auth | Yes (for private repos) |

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
2. **nervous_system/AGENTS.md** - Modify agent behavior and rules
3. **nervous_system/PERSONALITY.md** - Customize personality traits
4. **nervous_system/CRONS.json** - Define scheduled jobs
5. **workspace/job.md** - Define the task to execute
6. **roles/*.md** - Add or modify role-specific behaviors

## The Nervous System

These files in `nervous_system/` define the agent's character and behavior:

- **AGENTS.md** - Operational instructions (what to do, how to work)
- **PERSONALITY.md** - Personality and values (who the agent is)
- **HEARTBEAT.md** - Self-monitoring behavior
- **CRONS.json** - Scheduled job definitions

Additional files at root:
- **MEMORY.md** - Persistent knowledge across sessions

## Session Logs

Each job creates a session log at `workspace/logs/{JOB_ID}.jsonl`. This JSONL file contains the full conversation history and can be resumed for follow-up tasks via the `--session` flag.
