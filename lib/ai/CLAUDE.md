# lib/ai/ — LLM Integration

## Agent Types

Two agent types, both using `createReactAgent` from `@langchain/langgraph/prebuilt` with `SqliteSaver` for conversation memory:

**Job Agent** — singleton via `getJobAgent()`:
- System prompt: `config/JOB_PLANNING.md` (rendered fresh each invocation via `render_md()`)
- Tools: `create_job`, `get_job_status`, `get_system_technical_specs`, `get_skill_building_guide`, `get_skill_details`, + web search (if provider supports it)
- Call `resetAgent()` to clear the singleton (required if hot-reloading)

**Code Agent** — per-chat via `getCodeAgent({ repo, branch, workspaceId, chatId })`:
- System prompt: `config/CODE_PLANNING.md` (rendered fresh each invocation)
- Tools: `start_coding` (bound to workspace), `get_repository_details` (bound to repo/branch), + web search
- Keyed by `chatId` in an internal Map

## Adding a New Tool

1. Define in `tools.js` with Zod schema (use `tool()` from `@langchain/core/tools`)
2. Add to the agent's tools array in `agent.js`
3. Call `resetAgent()` if the job agent needs to pick up the new tool without restart

## Model Resolution

`createModel()` in `model.js` resolves provider/model at agent creation time (singleton for job agent). Provider determined by `LLM_PROVIDER` env var, model by `LLM_MODEL`. Changing these requires restart. See root `CLAUDE.md` LLM Providers table for supported providers and defaults.

## Chat Streaming

`chatStream()` in `index.js` yields chunks: `{ type: 'text', content }`, `{ type: 'tool-call', name, args }`, `{ type: 'tool-result', name, result }`. Called by `lib/chat/api.js` (the `/stream/chat` endpoint).
