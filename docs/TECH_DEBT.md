# Technical Debt

Living document tracking known debt, design issues, and cleanup opportunities.

---

## Critical

### ENV variable naming mismatch

`templates/.env.example` and `CLAUDE.md` document `EVENT_HANDLER_MODEL`, but `lib/ai/model.js` reads `LLM_MODEL`. Code also reads `LLM_PROVIDER` — neither variable is documented in `.env.example`.

**Files:** `lib/ai/model.js:18-19`, `templates/.env.example:34`, `CLAUDE.md:401`

### Hardcoded version in scaffolded package.json

`bin/cli.js:92` hardcodes `"thepopebot": "^1.0.0"` when generating the user's package.json. Should read from the package's own version dynamically.

**Files:** `bin/cli.js:92`

---

## High

### setup.mjs is a 639-line god function

`setup/setup.mjs` main() is one giant function handling prerequisites, GitHub init, PAT validation, API keys, secrets, variables, Telegram setup, and summary. Hard to test, skip, or resume individual steps.

**Files:** `setup/setup.mjs:82-721`

### No validation on config JSON parsing

`lib/cron.js` and `lib/triggers.js` call `JSON.parse()` on CRONS.json and TRIGGERS.json with no try-catch. Malformed JSON crashes the entire server at startup with an unhelpful error.

**Files:** `lib/cron.js:22`, `lib/triggers.js:57`

### No env var validation at startup

Environment variables are read inline across 10+ files. If a required var is missing, errors surface deep in execution (e.g., mid-request) instead of at startup. No central validation.

**Files:** `lib/tools/create-job.js`, `lib/tools/github.js`, `lib/ai/model.js`, `lib/channels/telegram.js`

### Silent catch-all in trigger firing

`api/index.js` wraps trigger firing in a try-catch that swallows all errors with no logging. If triggers break, there's zero visibility.

**Files:** `api/index.js:204-215`

---

## Medium

### Duplicated print helpers

`printSuccess`, `printWarning`, `printError`, `printInfo` are defined identically in both `setup/setup.mjs` and `setup/setup-telegram.mjs`. Should live in a shared `setup/lib/ui.mjs`.

**Files:** `setup/setup.mjs:66-80`, `setup/setup-telegram.mjs:18-28`

### Duplicated voice/audio transcription logic

`lib/channels/telegram.js` has near-identical blocks for voice (lines 54-71) and audio (lines 74-91) downloading/transcribing. Should be one helper.

**Files:** `lib/channels/telegram.js:54-91`

### Duplicate .env parsers

`setup/setup-telegram.mjs` has a custom regex-based .env parser that doesn't handle quoted values. `config/instrumentation.js` uses the `dotenv` package. Should use dotenv consistently.

**Files:** `setup/setup-telegram.mjs:33-47`, `config/instrumentation.js:20`

### Lazy loading triggers on first request

`api/index.js` lazy-loads triggers on the first POST request rather than at server startup. Adds latency to first request, cache is never invalidated, and if `loadTriggers()` throws, all subsequent requests fail.

**Files:** `api/index.js:20-27`

### Stale telegram token cache

`api/index.js` caches `TELEGRAM_BOT_TOKEN` in a module-level variable that's never invalidated. If token changes via setup, the cached value is stale until server restart.

**Files:** `api/index.js:8-18`

### Inconsistent API response shapes

Endpoints return different shapes: some have `{ ok: true }`, some have `{ error: "..." }`, some have `{ ok: true, skipped: true, reason: "..." }`. No standard envelope.

**Files:** `api/index.js`

### Overly broad try-catches hide error details

Several catch blocks return generic messages like `"Failed to create job"` with no error classification. Callers can't distinguish auth errors from network errors from invalid input.

**Files:** `api/index.js:60-72`, `api/index.js:85-88`, `api/index.js:173-176`

### GitHub job status assumes non-empty array

`lib/tools/github.js` accesses `jobsData.jobs[0]` without checking the array has elements.

**Files:** `lib/tools/github.js:88`

### Magic number: branch prefix slicing

`lib/tools/github.js` uses `run.head_branch.slice(4)` to strip "job/" — hardcodes the prefix length. Should use `.replace(/^job\//, '')`.

**Files:** `lib/tools/github.js:77`

### Docker layer caching

`templates/docker/Dockerfile` clones pi-skills repos and runs npm install without caching those layers effectively. Every build re-clones and reinstalls.

**Files:** `templates/docker/Dockerfile:40-44`

### Hardcoded HEARTBEAT.md location

`templates/config/HEARTBEAT.md` contains "Get the local weather for Claremont, CA" — a dev-specific placeholder that shouldn't be the default template.

**Files:** `templates/config/HEARTBEAT.md`

### Undocumented config variables

`MEMORY_BACKEND`, `MEMORY_PATH`, `LLM_PROVIDER`, and `LLM_MODEL` are supported by code but absent from `.env.example`.

**Files:** `templates/.env.example`, `lib/ai/model.js`, `lib/ai/memory.js`

---

## Low

### snake_case function in camelCase codebase

`render_md()` in `lib/utils/render-md.js` is the only snake_case function name. Everything else is camelCase.

**Files:** `lib/utils/render-md.js:14`

### ESM/CJS split

Core package uses CJS (`require`). Setup scripts use ESM (`.mjs` with `import`). Intentional (setup runs standalone, core runs inside Next.js), but prevents code sharing between layers.

**Files:** `api/`, `lib/`, `config/` (CJS) vs `setup/` (ESM)

### Confusing "Skipped" log message in init

`bin/cli.js` prints `"Skipped (already exists)"` for files that differ from templates. The message implies identity, but the file actually changed. Should say "Differs from template" or print nothing (the summary already lists them).

**Files:** `bin/cli.js:72`

### telegram.js has too many concerns

`lib/tools/telegram.js` handles markdown-to-HTML conversion, bot instance management, text splitting, Telegram API calls, and typing indicators in one file.

**Files:** `lib/tools/telegram.js`

### Magic numbers without constants

- `lib/tools/telegram.js:4` — `MAX_LENGTH` should be `TELEGRAM_MAX_MESSAGE_LENGTH`
- `lib/tools/telegram.js:131` — `maxLength * 0.3` — unexplained 30% threshold in smartSplit
- `lib/tools/telegram.js:263` — `5500 + Math.random() * 2500` — typing indicator timing
- `lib/tools/telegram.js:199` — `jobId.slice(0, 8)` — hardcoded short ID length
- `lib/tools/github.js:36` — `per_page: 20` — hardcoded page size

### Dead code in entrypoint.sh

`templates/docker/entrypoint.sh` has commented-out merge logic referencing a non-existent `MERGE_JOB.md`.

**Files:** `templates/docker/entrypoint.sh:97-101`

### Commented-out OpenAI provider

`lib/ai/model.js` has a commented-out OpenAI case. Either implement it or remove it.

**Files:** `lib/ai/model.js:34-38`

### buildLlmSecretsJson is a no-op wrapper

`setup/lib/auth.mjs` — `buildLlmSecretsJson(obj)` just returns `{ ...obj }`. Can be inlined.

**Files:** `setup/lib/auth.mjs:62-64`

### No logging strategy

All modules use raw `console.log` / `console.error`. No log levels, no module prefixes, no way to filter.

### Hardcoded GitHub API version

`lib/tools/github.js` hardcodes `X-GitHub-Api-Version: 2022-11-28`. Should be a module constant at minimum.

**Files:** `lib/tools/github.js:14`
