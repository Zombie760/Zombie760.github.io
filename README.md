# thepopebot

**Autonomous AI agents. All the power. None of the leaked API keys.**

---

## Why thepopebot?

**Secure by default** — Other frameworks hand credentials to the LLM and hope for the best. thepopebot is different: the AI literally cannot access your secrets, even if it tries. Secrets are filtered at the process level before the agent's shell even starts.

**The repository IS the agent** — Fork it and you fork everything: code, personality, scheduled jobs, logs, history. No external platform to configure. No vendor lock-in. Your agent lives in your repo.

**GitHub Actions IS the compute** — Every job runs in a fresh, isolated Docker container via GitHub Actions. Run one task or a thousand in parallel. No servers to manage, no infrastructure to maintain.

**Self-evolving** — The agent modifies its own code through pull requests. Every change is auditable, every change is reversible. You stay in control.

---

## How It Works

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  ┌─────────────────┐         ┌─────────────────┐                     │
│  │  Event Handler  │ ──1──►  │     GitHub      │                     │
│  │  (creates job)  │         │ (job/* branch)  │                     │
│  └────────▲────────┘         └────────┬────────┘                     │
│           │                           │                              │
│           │                           2 (triggers run-job.yml)    │
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
│           │                           4b (update-event-handler.yml)  │
│           │                           │                              │
│           5 (Telegram notification)   │                              │
│           └───────────────────────────┘                              │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

You talk to your bot on Telegram (or hit a webhook). The Event Handler creates a job branch. GitHub Actions spins up a Docker container with the Pi coding agent. The agent does the work, commits the results, and opens a PR. Auto-merge handles the rest. You get a Telegram notification when it's done.

---

## Free to Run

| | thepopebot | Other platforms |
|---|---|---|
| **Public repos** | Free. $0. GitHub Actions doesn't charge. | $20-100+/month |
| **Private repos** | 2,000 free minutes/month (every GitHub plan, including free) | $20-100+/month |
| **Infrastructure** | GitHub Actions (already included) | Dedicated servers |
| **Vendor lock-in** | None. It's your repo. | Yes |

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
| **ngrok*** | [ngrok.com](https://ngrok.com/download) |

*\*ngrok is only required for local development. Production deployments don't need it.*

### Three steps

**Step 1** — Fork this repository:

[![Fork this repo](https://img.shields.io/badge/Fork_this_repo-238636?style=for-the-badge&logo=github&logoColor=white)](https://github.com/stephengpope/thepopebot/fork)

> GitHub Actions are disabled by default on forks. Go to the **Actions** tab in your fork and enable them.

**Step 2** — Clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/thepopebot.git
cd thepopebot
```

**Step 3** — Run the setup wizard:

```bash
npm run setup
```

The wizard handles everything:
- Checks prerequisites (Node.js, Git, GitHub CLI, ngrok)
- Creates a GitHub Personal Access Token
- Collects API keys (Anthropic required; OpenAI, Groq, and [Brave Search](https://api-dashboard.search.brave.com/app/keys) optional)
- Sets GitHub repository secrets and variables
- Sets up Telegram bot
- Starts the server + ngrok, generates `event_handler/.env`
- Registers webhooks and verifies everything works

**After setup, message your Telegram bot to create jobs!**

---

## Sample Project

Want to see what a fully configured agent looks like? Check out the financial advisor example:

[**docs/sample_projects/FINANCIAL_ADVISOR.md**](docs/sample_projects/FINANCIAL_ADVISOR.md)

---

## Docs

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Two-layer design, file structure, API endpoints, GitHub Actions, Docker agent |
| [Configuration](docs/CONFIGURATION.md) | Environment variables, GitHub secrets, repo variables, ngrok, Telegram setup |
| [Customization](docs/CUSTOMIZATION.md) | Personality, skills, operating system files, using your bot, security details |
| [Auto-Merge](docs/AUTO_MERGE.md) | Auto-merge controls, ALLOWED_PATHS configuration |
| [How to Use Pi](docs/HOW_TO_USE_PI.md) | Guide to the Pi coding agent |
| [Security](docs/SECURITY_TODO.md) | Security hardening plan |
