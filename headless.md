# Headless + Interactive Code Mode — Implementation Report

## Architecture

Two mutually exclusive container types share a named Docker volume so work persists across switches.

| | Headless (default) | Interactive |
|---|---------|------------|
| **Image** | `claude-code-headless` | `claude-code-workspace` |
| **Runs** | `claude -p` headlessly | tmux + ttyd |
| **Lifecycle** | Ephemeral — starts, does task, exits | Long-lived — stays running |
| **Chat** | Stays active (tool call blocks while running) | Frozen — redirects to terminal |
| **Volume** | Shared `code-workspace-{shortId}` | Same shared volume |

**Mode detection:** No DB column — mode is derived from `containerName`. Set = interactive, null = headless.

---

## Flow

### Headless (default)

1. User sends message in code chat
2. AI calls `start_headless_coding` tool with task description
3. Ephemeral container boots with shared volume
4. Entrypoint: clone (or reset if volume exists) → checkout feature branch → run `claude -p`
5. On success: commit → rebase onto base → merge back → push → destroy volume
6. On failure: leave volume intact → notify user (they can switch to interactive to fix)
7. Tool returns output to chat — chat stays active for follow-up

### Interactive (explicit switch)

1. AI calls `start_coding` tool — boots persistent container with same volume
2. Chat freezes, user redirected to terminal
3. User clicks "Interactive" badge in branch bar to close → stops container, clears `containerName`
4. Volume preserved — headless can reuse it

### Interactive recovery after headless failure

1. Headless fails → volume has dirty state
2. User switches to interactive → container boots with same volume
3. Entrypoint skips clone (`.git` exists) → user picks up where headless left off

---

## Feature Branch Lifecycle

Generated in two phases:

1. **Workspace creation** (`lib/ai/index.js` chatStream): `thepopebot/new-chat-{shortId}`
2. **autoTitle fires** (`lib/ai/index.js` autoTitle): `thepopebot/{title-slug}-{shortId}`

Both `start_coding` and `start_headless_coding` read `workspace.featureBranch` from DB — no generation in tools.

---

## Files Modified

### `lib/ai/index.js`

- **chatStream() workspace creation block (~line 117-130):** After `createCodeWorkspace()`, generates initial feature branch name and saves it via `updateFeatureBranch()`.
- **autoTitle() (~line 258-266):** After updating chat title, checks if chat has a `codeWorkspaceId` and updates the feature branch with the real title slug.

### `lib/ai/tools.js`

- **`createStartCodingTool()`:** Simplified — removed feature branch generation. Now reads `workspace.featureBranch` from DB. Passes `workspaceId` to `createCodeWorkspaceContainer()` for volume mount.
- **`createStartHeadlessCodingTool()` (NEW):** Launches ephemeral headless container, tails logs until exit, checks exit code. On success: removes volume (work merged). On failure: leaves volume for interactive recovery. Returns last 4k chars of output.

### `lib/ai/agent.js`

- Imports `createStartHeadlessCodingTool`.
- Code agent tools array: `[startHeadlessCodingTool, startCodingTool, getRepoDetailsTool]` — headless listed first as default.

### `lib/tools/docker.js`

- **`dockerApiStream()`** (NEW): Raw streaming Docker API request — returns `http.IncomingMessage` for log tailing.
- **`volumeName()`** (NEW): Derives `code-workspace-{shortId}` from workspace ID.
- **`createCodeWorkspaceContainer()`:** Now accepts `workspaceId` param. Adds shared named volume bind (`code-workspace-{shortId}:/home/claude-code/workspace`) when `workspaceId` provided.
- **`createHeadlessCodeContainer()`** (NEW): Creates ephemeral container with `claude-code-headless` image. Env: `REPO`, `BRANCH`, `FEATURE_BRANCH`, `HEADLESS_TASK`, `CLAUDE_CODE_OAUTH_TOKEN`, `GH_TOKEN`. Always uses shared volume.
- **`tailContainerLogs()`** (NEW): `GET /containers/{name}/logs?follow=true` — returns raw readable stream.
- **`waitForContainer()`** (NEW): `POST /containers/{name}/wait` — blocks until exit, returns exit code.
- **`removeCodeWorkspaceVolume()`** (NEW): `DELETE /volumes/code-workspace-{shortId}`.

### `lib/code/actions.js`

- Imports `updateContainerName`.
- **`closeInteractiveMode()` (NEW):** Server action — stops and removes interactive container, sets `containerName` to null. Does NOT remove volume.

### `lib/chat/components/chat.jsx`

- Renamed `isWorkspaceLaunched` → `isInteractiveActive` (only interactive freezes chat, not headless).
- Passes `workspace` and `isInteractiveActive` props to `CodeModeToggle`.

### `lib/chat/components/code-mode-toggle.jsx`

- **Locked branch bar (after first message):**
  - Left side: `repo → branch → featureBranch` with arrows, truncation, tooltips
  - Right side: Mode badge — "Headless" (static) or "Interactive" (clickable, closes container)
- **Close interactive:** Calls `closeInteractiveMode()` server action, reloads page.
- Accepts new props: `workspace`, `isInteractiveActive`.

---

## Files Created

### `templates/docker/claude-code-headless/Dockerfile`

Based on `claude-code-workspace` Dockerfile but stripped down:
- No tmux, no ttyd (headless — no terminal needed)
- Has: Claude Code, git, gh, jq, Node.js 22
- Copies `commands/` directory (for `ai-merge-back.md`)
- No `PORT` env var
- Env vars: `REPO`, `BRANCH`, `FEATURE_BRANCH`, `HEADLESS_TASK`

### `templates/docker/claude-code-headless/entrypoint.sh`

```
Git setup (gh auth, user identity)
  ↓
cd /home/claude-code/workspace
  ↓
Volume empty? → git clone --branch $BRANCH
Volume has .git? → git fetch + checkout $BRANCH + reset --hard + clean
  ↓
Feature branch exists on remote? → checkout -B from remote
Doesn't exist? → create + push -u
  ↓
Claude Code auth (OAuth token, skip onboarding)
  ↓
claude -p "$HEADLESS_TASK" --dangerously-skip-permissions --verbose --output-format stream-json
  ↓
Exit 0? → git add -A → commit → rebase origin/$BRANCH → push --force-with-lease → merge → push → "MERGE_SUCCESS"
  Rebase fails? → abort → run ai-merge-back command via claude -p
Exit non-0? → "AGENT_FAILED" → exit with agent's code (volume preserved)
```

### `templates/docker/claude-code-headless/commands/`

Copied from `claude-code-workspace/commands/`:
- `ai-merge-back.md` — AI-driven rebase + conflict resolution + merge
- `commit-changes.md` — Stage, commit with conventional prefix, push

---

## What's NOT in this implementation

- **No DB migration** — `featureBranch` column already existed, no `mode` column needed
- **No streaming tool output to chat UI** — the `start_headless_coding` tool blocks and returns the full output at the end. Streaming chunks through LangChain tool calls requires deeper AI SDK integration (marked as TODO in plan).
- **No automatic mode toggle UI** — user sees a mode badge but can't toggle between headless/interactive from the UI. Interactive is entered via `start_coding` tool; closed via the badge button. Headless is the default when no container is running.
