import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createModel } from './model.js';
import { createJobTool, getJobStatusTool } from './tools.js';
import { createCheckpointer } from './memory.js';
import { chatbotMd } from '../paths.js';
import { render_md } from '../utils/render-md.js';

let _agent = null;

/**
 * Get or create the LangGraph agent singleton.
 * Uses createReactAgent which handles the tool loop automatically.
 */
export async function getAgent() {
  if (!_agent) {
    const model = await createModel();
    const tools = [createJobTool, getJobStatusTool];
    const checkpointer = await createCheckpointer();
    const systemPrompt = render_md(chatbotMd);

    _agent = createReactAgent({
      llm: model,
      tools,
      checkpointSaver: checkpointer,
      prompt: systemPrompt,
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
