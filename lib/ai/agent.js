import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { SystemMessage } from '@langchain/core/messages';
import { createModel } from './model.js';
import { createJobTool, getJobStatusTool, getSystemTechnicalSpecsTool, getSkillBuildingGuideTool, getSkillDetailsTool, createStartCodingTool } from './tools.js';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { existsSync } from 'fs';
import { eventHandlerMd, codeAgentMd, thepopebotDb } from '../paths.js';
import { render_md } from '../utils/render-md.js';

let _agent = null;

/**
 * Get or create the LangGraph agent singleton.
 * Uses createReactAgent which handles the tool loop automatically.
 * Prompt is a function so {{datetime}} resolves fresh each invocation.
 */
export async function getAgent() {
  if (!_agent) {
    const model = await createModel();
    const tools = [createJobTool, getJobStatusTool, getSystemTechnicalSpecsTool, getSkillBuildingGuideTool, getSkillDetailsTool];
    const checkpointer = SqliteSaver.fromConnString(thepopebotDb);

    _agent = createReactAgent({
      llm: model,
      tools,
      checkpointSaver: checkpointer,
      prompt: (state) => [new SystemMessage(render_md(eventHandlerMd)), ...state.messages],
    });
  }
  return _agent;
}

/**
 * Reset the agent singleton (e.g., when config changes).
 */
export function resetAgent() {
  _agent = null;
}

const _codeAgents = new Map();

const CODE_AGENT_SYSTEM_PROMPT = `You are a helpful coding assistant. The user has selected a GitHub repository and branch to work on. Your job is to help them discuss and plan what they want to build.

You have one tool available: start_coding — this launches a live Claude Code workspace where the actual coding happens.

IMPORTANT RULES:
- Help the user discuss, plan, and refine their idea through conversation
- Answer questions about their project, architecture, approach, etc.
- Do NOT call start_coding until the user explicitly indicates they are ready (e.g. "let's start coding", "okay let's get started", "launch it", "go ahead")
- Never force-call the tool immediately — have a conversation first
- You do NOT have access to the repo's code — you can only discuss and plan
- When you do call start_coding, provide a thorough task_description summarizing what the user wants to build based on the conversation`;

/**
 * Get or create a code agent for a specific chat/workspace.
 * Each code chat gets its own agent with unique start_coding tool bindings.
 * @param {object} context
 * @param {string} context.repo - GitHub repo
 * @param {string} context.branch - Git branch
 * @param {string} context.workspaceId - Pre-created workspace row ID
 * @param {string} context.chatId - Chat thread ID
 * @returns {Promise<object>} LangGraph agent
 */
export async function getCodeAgent({ repo, branch, workspaceId, chatId }) {
  if (_codeAgents.has(chatId)) {
    return _codeAgents.get(chatId);
  }

  const model = await createModel();
  const startCodingTool = createStartCodingTool({ repo, branch, workspaceId });
  const checkpointer = SqliteSaver.fromConnString(thepopebotDb);

  const agent = createReactAgent({
    llm: model,
    tools: [startCodingTool],
    checkpointSaver: checkpointer,
    prompt: (state) => {
      const systemPrompt = existsSync(codeAgentMd) ? render_md(codeAgentMd) : CODE_AGENT_SYSTEM_PROMPT;
      return [new SystemMessage(systemPrompt), ...state.messages];
    },
  });

  _codeAgents.set(chatId, agent);
  return agent;
}
