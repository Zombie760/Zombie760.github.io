const { createReactAgent } = require('@langchain/langgraph/prebuilt');
const { createModel } = require('./model');
const { createJobTool, getJobStatusTool } = require('./tools');
const { createCheckpointer } = require('./memory');
const paths = require('../paths');
const { render_md } = require('../utils/render-md');

let _agent = null;

/**
 * Get or create the LangGraph agent singleton.
 * Uses createReactAgent which handles the tool loop automatically.
 */
function getAgent() {
  if (!_agent) {
    const model = createModel();
    const tools = [createJobTool, getJobStatusTool];
    const checkpointer = createCheckpointer();
    const systemPrompt = render_md(paths.chatbotMd);

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
function resetAgent() {
  _agent = null;
}

module.exports = { getAgent, resetAgent };
