import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { SystemMessage } from '@langchain/core/messages';
import { createModel } from './model.js';
import { createJobTool, getJobStatusTool, getSystemTechnicalSpecsTool, getSkillBuildingGuideTool, getSkillDetailsTool, createStartCodingTool, createGetRepositoryDetailsTool } from './tools.js';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { jobPlanningMd, codePlanningMd, thepopebotDb } from '../paths.js';
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
      prompt: (state) => [new SystemMessage(render_md(jobPlanningMd)), ...state.messages],
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
  const getRepoDetailsTool = createGetRepositoryDetailsTool({ repo, branch });
  const checkpointer = SqliteSaver.fromConnString(thepopebotDb);

  const agent = createReactAgent({
    llm: model,
    tools: [startCodingTool, getRepoDetailsTool],
    checkpointSaver: checkpointer,
    prompt: (state) => [new SystemMessage(render_md(codePlanningMd)), ...state.messages],
  });

  _codeAgents.set(chatId, agent);
  return agent;
}
