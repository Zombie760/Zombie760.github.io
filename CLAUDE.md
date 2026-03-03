# thepopebot — Package Source Reference

Technical reference for AI assistants modifying the thepopebot NPM package source code.

**Architecture**: Event Handler (Next.js) creates `job/*` branches → GitHub Actions runs Docker agent (Pi or Claude Code) → task executed → PR created → auto-merge → notification. Agent jobs log to `logs/{JOB_ID}/`.

## Deployment Model

The npm package (`api/`, `lib/`, `config/`, `bin/`) is published to npm. In production:

- **Event handler**: Docker container installs the published package from npm. The user's project (`config/`, `skills/`, `.env`, `data/`) is volume-mounted at `/app`. Runs `server.js` via PM2 behind Traefik reverse proxy.
- **`lib/paths.js`**: Central path resolver — ALL paths resolve from `process.cwd()`. This is how the installed npm package finds the volume-mounted user project files.
- **Job containers**: Ephemeral Docker containers clone `job/*` branches separately — NOT volume-mounted. See `templates/docker/CLAUDE.md`.
- **Local install**: Gives users CLI tools (`init`, `setup`, `upgrade`) and thin Next.js wiring for dev.

## Package vs. Templates — Where Code Goes

All event handler logic, API routes, library code, and core functionality lives in the **npm package** (`api/`, `lib/`, `config/`, `bin/`). This is what users import when they `import ... from 'thepopebot/...'`.

The `templates/` directory contains **only files that get scaffolded into user projects** via `npx thepopebot init`. Templates are for user-editable configuration and thin wiring — things users are expected to customize or override. Never add core logic to templates.

**When adding or modifying event handler code, always put it in the package itself (e.g., `api/`, `lib/`), not in `templates/`.** Templates should only contain:
- Configuration files users edit (`config/SOUL.md`, `config/CRONS.json`, etc.)
- Thin Next.js wiring (`next.config.mjs`, `instrumentation.js`, catch-all route)
- GitHub Actions workflows
- Docker files
- CLAUDE.md files for AI assistant context in user projects

### Managed Paths

Files in managed directories are auto-synced (created, updated, **and deleted**) by `init` to match the package templates exactly. Users should not edit these files — changes will be overwritten on upgrade. Managed paths are defined in `bin/managed-paths.js`:

- `.github/workflows/` — CI/CD workflows
- `docker/` — All Docker files (Dockerfiles, entrypoints, CLAUDE.md)
- `docker-compose.yml`, `.dockerignore` — Docker config
- `CLAUDE.md` — AI assistant context
- `app/` — All Next.js pages, layouts, and routes

### CSS Customization

`app/globals.css` is managed and auto-updated. Users customize appearance via `theme.css` (project root), which is loaded after globals.css and not managed — user owns it.

## Directory Structure

```
/
├── api/                        # GET/POST handlers for all /api/* routes
├── lib/
│   ├── actions.js              # Shared action executor (agent, command, webhook)
│   ├── cron.js                 # Cron scheduler (loads CRONS.json)
│   ├── triggers.js             # Webhook trigger middleware (loads TRIGGERS.json)
│   ├── paths.js                # Central path resolver (resolves from process.cwd())
│   ├── ai/                     # LLM integration (agent, model, tools, streaming)
│   ├── auth/                   # NextAuth config, helpers, middleware, server actions, components
│   ├── channels/               # Channel adapters (base class, Telegram, factory)
│   ├── chat/                   # Chat route handler, server actions, React UI components
│   ├── code/                   # Code workspaces (server actions, terminal view, WebSocket proxy)
│   ├── db/                     # SQLite via Drizzle (schema, migrations, api-keys)
│   ├── tools/                  # Job creation, GitHub API, Telegram, Docker, Whisper
│   └── utils/
│       └── render-md.js        # Markdown {{include}} processor
├── config/
│   ├── index.js                # withThepopebot() Next.js config wrapper
│   └── instrumentation.js      # Server startup hook (loads .env, starts crons)
├── bin/                        # CLI entry point (init, setup, reset, diff, upgrade)
├── setup/                      # Interactive setup wizard
├── templates/                  # Scaffolded to user projects (see rule above)
├── docs/                       # Extended documentation
└── package.json
```

## NPM Package Exports

Exports defined in `package.json` `exports` field. Pattern: `thepopebot/{module}` maps to source files in `api/`, `lib/`, `config/`. Add new exports there when creating new importable modules.

## Build System

Run `npm run build` before publish. esbuild compiles `lib/chat/components/**/*.jsx`, `lib/auth/components/**/*.jsx`, `lib/code/*.jsx` to ES modules.

## Database

SQLite via Drizzle ORM at `data/thepopebot.sqlite` (override with `DATABASE_PATH`). Auto-initialized on server start. See `lib/db/CLAUDE.md` for schema details, CRUD patterns, and column naming.

### Migration Rules

**All schema changes MUST go through the migration workflow.**

- **NEVER** write raw `CREATE TABLE`, `ALTER TABLE`, or any DDL SQL manually
- **NEVER** modify `initDatabase()` to add schema changes
- **ALWAYS** make schema changes by editing `lib/db/schema.js` then running `npm run db:generate`

## Security: /api vs Server Actions

**`/api` routes are for external callers only.** They authenticate via `x-api-key` header or webhook secrets (Telegram, GitHub). Never add session/cookie auth to `/api` routes.

**Browser UI uses Server Actions.** All authenticated browser-to-server calls MUST use Next.js Server Actions (`'use server'` functions in `lib/chat/actions.js` or `lib/auth/actions.js`), not `/api` fetch calls. Server Actions use the `requireAuth()` pattern which validates the session cookie internally.

**Exception: chat streaming.** The AI SDK's `DefaultChatTransport` requires an HTTP endpoint. Chat has its own route handler at `lib/chat/api.js` (mapped to `/stream/chat`) with session auth, outside `/api`.

| Caller | Mechanism | Auth | Location |
|--------|-----------|------|----------|
| External (cURL, GitHub Actions, Telegram) | `/api` route handler | `x-api-key` or webhook secret | `api/index.js` |
| Browser UI (data/mutations) | Server Action | `requireAuth()` session check | `lib/chat/actions.js`, `lib/auth/actions.js` |
| Browser UI (chat streaming) | Dedicated route handler | `auth()` session check | `lib/chat/api.js` |

## Action Dispatch System

Both cron jobs and webhook triggers use the same shared dispatch system (`lib/actions.js`). Every action has a `type` field — `"agent"` (default), `"command"`, or `"webhook"`.

| | `agent` | `command` | `webhook` |
|---|---------|-----------|-----------|
| **Uses LLM** | Yes — spins up a Docker agent container (Pi or Claude Code) | No — runs a shell command | No — makes an HTTP request |
| **Runtime** | Minutes to hours | Milliseconds to seconds | Milliseconds to seconds |
| **Cost** | LLM API calls + GitHub Actions minutes | Free (runs on event handler) | Free (runs on event handler) |

If the task needs to *think*, use `agent`. If it just needs to *do*, use `command`. If it needs to *call an external service*, use `webhook`.

**Agent**: Creates a Docker Agent job via `createJob()`. Pushes a `job/*` branch; `run-job.yml` spins up the container. The `job` string is the LLM task prompt. Agent backend selected via `agent_backend` in `job.config.json`.

**Command**: Runs a shell command on the event handler. Working directory: `cron/` for crons, `triggers/` for triggers.

**Webhook**: Makes an HTTP request. `GET` skips the body; `POST` (default) sends `{ ...vars }` or `{ ...vars, data: <payload> }`.

### Cron Jobs

Defined in `config/CRONS.json`, loaded by `lib/cron.js` at startup via `node-cron`. Each entry has `name`, `schedule` (cron expression), `type` (`agent`/`command`/`webhook`), and the corresponding action fields (`job`, `command`, or `url`/`method`/`headers`/`vars`). Set `enabled: false` to disable. Agent-type entries support optional `llm_provider` and `llm_model` fields to override the default LLM (passed to Docker agent via `job.config.json`).

### Webhook Triggers

Defined in `config/TRIGGERS.json`, loaded by `lib/triggers.js`. Each trigger watches an endpoint path (`watch_path`) and fires an array of actions (fire-and-forget, after auth, before route handler). Actions use the same `type`/`job`/`command`/`url` fields as cron jobs, including optional `llm_provider`/`llm_model` overrides. Template tokens in `job` and `command` strings: `{{body}}`, `{{body.field}}`, `{{query}}`, `{{query.field}}`, `{{headers}}`, `{{headers.field}}`.

## LLM Providers

| Provider | `LLM_PROVIDER` | Default Model | Required Env |
|----------|----------------|---------------|-------------|
| Anthropic | `anthropic` (default) | `claude-sonnet-4-20250514` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai` | `gpt-4o` | `OPENAI_API_KEY` |
| Google | `google` | `gemini-2.5-pro` | `GOOGLE_API_KEY` |
| Custom | `custom` | — | `OPENAI_BASE_URL`, `CUSTOM_API_KEY` (optional) |

`LLM_MAX_TOKENS` defaults to 4096. Web search available for `anthropic` and `openai` providers only (disable with `WEB_SEARCH=false`).

## Code Workspaces

Interactive Docker containers with in-browser terminal (xterm.js → WebSocket → ttyd). Key files: `lib/code/actions.js` (server actions), `lib/code/ws-proxy.js` (WebSocket auth proxy), `lib/tools/docker.js` (container lifecycle). See `lib/code/CLAUDE.md` for data flow and auth details.

## Skills System

Plugin directories under `skills/`. Activate by symlinking into `skills/active/`. Each skill has `SKILL.md` with YAML frontmatter (`name`, `description`). The `{{skills}}` template variable in markdown files resolves active skill descriptions at runtime. Default active skills: `browser-tools`, `llm-secrets`, `modify-self`.

## Template Config Files

Users customize behavior through these files in `config/`:
- `SOUL.md` — Agent personality/identity
- `JOB_PLANNING.md` — Event handler system prompt (supports `{{skills}}`, `{{web_search}}`, `{{datetime}}`)
- `CODE_PLANNING.md` — Code workspace system prompt
- `CRONS.json`, `TRIGGERS.json` — Scheduled jobs and webhook triggers

## Markdown File Includes

Markdown files in `config/` support includes and built-in variables, powered by `lib/utils/render-md.js`.

- **File includes**: `{{ filepath.md }}` — resolves relative to project root, recursive with circular detection. Missing files are left as-is.
- **`{{datetime}}`** — Current ISO timestamp.
- **`{{skills}}`** — Dynamic bullet list of active skill descriptions from `skills/active/*/SKILL.md` frontmatter. Never hardcode skill names — this is resolved at runtime.
- **`{{web_search}}`** — Conditionally includes `config/WEB_SEARCH_AVAILABLE.md` or `config/WEB_SEARCH_UNAVAILABLE.md` based on provider support.

## Authentication

NextAuth v5 with Credentials provider (email/password), JWT in httpOnly cookies. First visit creates admin account. `requireAuth()` validates sessions in server actions. API routes use `x-api-key` header. `AUTH_SECRET` env var required for session encryption.

## Config Variable Architecture

`LLM_MODEL` and `LLM_PROVIDER` exist in two separate systems using the same names:

- **`.env`** — read by the event handler (chat). Set by `setup/lib/sync.mjs`.
- **GitHub repository variables** — read by `run-job.yml` (agent jobs). Set by `setup/lib/sync.mjs`.

These are independent environments. They use the same variable names. They can hold different values (e.g. chat uses sonnet, jobs use opus). Do NOT create separate `AGENT_LLM_*` variable names — just set different values in `.env` vs GitHub variables.
