# thepopebot

A template repository for creating custom autonomous AI agents. Clone this repo, customize the config files, and run via Docker to execute tasks autonomously.

## How It Works

```
1. Clone this template → 2. Customize config → 3. Push to your repo → 4. Run Docker
                                                                            ↓
                                             Your agent commits results ← Agent runs your task
```

The Docker container:
1. Clones YOUR repository at runtime
2. Runs the Pi coding agent with YOUR customizations
3. Commits results back to YOUR repo

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
  -e GITHUB_TOKEN=ghp_xxxx \
  my-agent
```

The agent will clone your repo, execute the task, and commit the results.

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

### nervous_system/

Agent behavior and personality configuration:
- **AGENTS.md** - Core behavioral instructions (what to do, workflow patterns)
- **PERSONALITY.md** - Personality traits and values
- **HEARTBEAT.md** - Self-monitoring behavior
- **CRONS.json** - Scheduled jobs (set `"enabled": true` to activate)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REPO_URL` | Your repository URL | Yes |
| `BRANCH` | Branch to work on | Yes |
| `GITHUB_TOKEN` | GitHub PAT for authentication | Yes (private repos) |

## File Structure

```
/
├── auth.json               # API credentials
├── nervous_system/
│   ├── AGENTS.md           # Agent behavior rules
│   ├── PERSONALITY.md      # Agent personality
│   ├── HEARTBEAT.md        # Self-monitoring
│   └── CRONS.json          # Scheduled jobs
├── MEMORY.md               # Persistent knowledge
├── TOOLS.md                # Available tools
├── MERGE_JOB.md            # Post-job merge instructions
├── Dockerfile              # Container definition
├── entrypoint.sh           # Startup script
├── roles/
│   ├── orchestrator.md     # Orchestrator behavior
│   └── worker.md           # Worker behavior
└── workspace/
    ├── job.md              # Current task
    └── logs/               # Session logs
```

## What's in the Container

- Node.js 22
- Pi coding agent
- Playwright + Chromium (headless browser, CDP port 9222)
- Git + GitHub CLI

## Runtime Flow

1. Container starts Chrome in headless mode
2. Clones your repository to `/job`
3. Sets `PI_CODING_AGENT_DIR=/job` (so Pi finds auth.json)
4. Runs Pi with AGENTS.md + job.md as instructions
5. Commits all changes: `thepopebot: job {UUID}`
6. Optionally runs merge operations
7. Commits final state: `done.`

## Customization

### Customize the Nervous System

Edit files in `nervous_system/`:
- **AGENTS.md** - Git conventions, prohibited actions, error handling, protocols
- **PERSONALITY.md** - Identity, traits, working style, values
- **CRONS.json** - Scheduled job definitions

### Define Tasks

Edit `workspace/job.md` with:
- Clear task description
- Specific requirements
- Expected outputs

## Roles

| Role | Description |
|------|-------------|
| `worker` | Executes tasks, writes code, makes commits |
| `orchestrator` | Manages branches, merges PRs, resolves conflicts |

Role-specific behaviors are defined in `roles/*.md`.

## Session Logs

Each job creates a session log at `workspace/logs/{JOB_ID}.jsonl`. These can be used to resume sessions or review agent actions.
