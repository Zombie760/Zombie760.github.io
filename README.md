# thepopebot

**Autonomous AI agents. All the power. None of the leaked API keys.**

---

## Why thepopebot?

**Secure by default** — Other frameworks hand credentials to the LLM and hope for the best. thepopebot is different: the AI literally cannot access your secrets, even if it tries. Secrets are filtered at the process level before the agent's shell even starts.

**The repository IS the agent** — Every action your agent takes is a git commit. You can see exactly what it did, when, and why. If it screws up, revert it. Want to clone your agent? Fork the repo — code, personality, scheduled jobs, full history, all of it goes with your fork.

**Free compute, built in** — Every GitHub account comes with free cloud computing time. thepopebot uses that to run your agent. One task or a hundred in parallel — the compute is already included.

**Self-evolving** — The agent modifies its own code through pull requests. Every change is auditable, every change is reversible. You stay in control.

---

## How It Works

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌─────────────────┐         ┌─────────────────┐                     │
│  │  Event Handler  │ ──1──►  │     GitHub      │                     │
│  │  (creates job)  │         │ (job/* branch)  │                     │
│  └────────▲────────┘         └────────┬────────┘                     │
│           │                           │                              │
│           │                           2 (triggers run-job.yml)       │
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
│           │                           4a (auto-merge.yml)            │
│           │                           4b (rebuild-event-handler.yml) │
│           │                           │                              │
│           5 (notify-pr-complete.yml / │                              │
│           │  notify-job-failed.yml)   │                              │
│           └───────────────────────────┘                              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

You interact with your bot via the web chat interface or Telegram (optional). The Event Handler creates a job branch. GitHub Actions spins up a Docker container with the Pi coding agent. The agent does the work, commits the results, and opens a PR. Auto-merge handles the rest. You get a notification when it's done.

---

## Get FREE server time on Github!

| | thepopebot | Other platforms |
|---|---|---|
| **Public repos** | Free. $0. GitHub Actions doesn't charge. | $20-100+/month |
| **Private repos** | 2,000 free minutes/month (every GitHub plan, including free) | $20-100+/month |
| **Infrastructure** | GitHub Actions (already included) | Dedicated servers |

You just bring your own [Anthropic API key](https://console.anthropic.com/).

---

## Get Started

### Prerequisites

| Requirement | Install |
|-------------|---------|
| **Node.js 18+** | [nodejs.org](https://nodejs.org) |
| **npm** | Included with Node.js |
| **Git** | [git-scm.com](https://git-scm.com) |
| **GitHub CLI** | [cli.github.com](https://cli.github.com) |
| **Docker + Docker Compose** | [docker.com](https://docs.docker.com/get-docker/) |
| **ngrok*** | [ngrok.com](https://ngrok.com/download) |

*\*ngrok is only required for local installs without port forwarding. VPS/cloud deployments don't need it.*

### Three steps

**Step 1** — Scaffold a new project:

```bash
mkdir my-agent && cd my-agent
npx thepopebot init
```

This creates a Next.js project with configuration files, GitHub Actions workflows, and agent templates. You don't need to create a GitHub repo first — the setup wizard handles that.

**Step 2** — Run the setup wizard:

```bash
npm run setup
```

The wizard walks you through everything:
- Checks prerequisites (Node.js, Git, GitHub CLI)
- Creates a GitHub repository and pushes your initial commit
- Creates a GitHub Personal Access Token (scoped to your repo)
- Collects API keys (Anthropic required; OpenAI, Brave optional)
- Sets GitHub repository secrets and variables
- Generates `.env`
- Builds the project

**Step 3** — Start your agent:

```bash
docker compose up -d
```

- **Web Chat**: Visit your APP_URL to chat with your agent, create jobs, upload files
- **Telegram** (optional): Run `npm run setup-telegram` to connect a Telegram bot
- **Webhook**: Send a POST to `/api/create-job` with your API key to create jobs programmatically
- **Cron**: Edit `config/CRONS.json` to schedule recurring jobs

> **Local installs**: Your server needs to be reachable from the internet for GitHub webhooks and Telegram. On a VPS/cloud server, your APP_URL is just your domain. For local development, use [ngrok](https://ngrok.com) (`ngrok http 80`) or port forwarding to expose your machine. If your ngrok URL changes, update APP_URL in `.env` and the GitHub repository variable, and re-run `npm run setup-telegram` if Telegram is configured.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=stephengpope/thepopebot&type=date&legend=top-left)](https://www.star-history.com/#stephengpope/thepopebot&type=date&legend=top-left)

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `npx thepopebot init` | Scaffold a new project, or check for updated templates in an existing one |
| `npx thepopebot diff [file]` | List files that differ from package templates, or show the diff for a specific file |
| `npx thepopebot reset [file]` | List all template files, or restore a specific file (or directory) to the package default |
| `npm run setup` | Run the full interactive setup wizard |
| `npm run setup-telegram` | Reconfigure the Telegram webhook (useful when your ngrok URL changes) |

---

## Updating

Your customizations are always preserved — template changes are never applied automatically.

**1. Update the package**

```bash
npm update thepopebot
```

**2. Scaffold new templates**

```bash
npx thepopebot init
```

This scaffolds any new template files (existing files are never overwritten), runs `npm install`, and updates `THEPOPEBOT_VERSION` in your local `.env`. It also reports which templates have drifted:

```
Updated templates available:
These files differ from the current package templates.

  config/CRONS.json
  .github/workflows/run-job.yml

To view differences:  npx thepopebot diff <file>
To reset to default:  npx thepopebot reset <file>
```

Review and accept changes at your own pace:

```bash
npx thepopebot diff config/CRONS.json    # see what changed
npx thepopebot reset config/CRONS.json   # accept the new template
```

Or manually merge the changes if you want to keep some of your edits.

**3. Rebuild for local dev**

```bash
npm run build
```

**4. Commit and push**

```bash
git add -A && git commit -m "upgrade thepopebot to vX.X.X"
git push
```

Pushing to `main` triggers the `rebuild-event-handler.yml` workflow on your server. It detects the version change, runs `thepopebot init`, updates `THEPOPEBOT_VERSION` in the server's `.env`, pulls the new Docker image, restarts the container, rebuilds `.next`, and reloads PM2 — no manual `docker compose` needed.

---

## Docs

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Two-layer design, file structure, API endpoints, GitHub Actions, Docker agent |
| [Configuration](docs/CONFIGURATION.md) | Environment variables, GitHub secrets, repo variables, ngrok, Telegram setup |
| [Customization](docs/CUSTOMIZATION.md) | Personality, skills, operating system files, using your bot, security details |
| [Chat Integrations](docs/CHAT_INTEGRATIONS.md) | Web chat, Telegram, adding new channels |
| [Auto-Merge](docs/AUTO_MERGE.md) | Auto-merge controls, ALLOWED_PATHS configuration |
| [How to Use Pi](docs/HOW_TO_USE_PI.md) | Guide to the Pi coding agent |
