const { ChatAnthropic } = require('@langchain/anthropic');

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * Create a LangChain chat model based on environment configuration.
 *
 * Config env vars:
 *   LLM_PROVIDER    — "anthropic" (default). Future: "openai", "google", etc.
 *   LLM_MODEL       — Model name override (e.g. "claude-sonnet-4-20250514")
 *   ANTHROPIC_API_KEY — Required for anthropic provider
 *
 * @param {object} [options]
 * @param {number} [options.maxTokens=4096] - Max tokens for the response
 * @returns {import('@langchain/core/language_models/chat_models').BaseChatModel}
 */
function createModel(options = {}) {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  const modelName = process.env.LLM_MODEL || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || 4096;

  switch (provider) {
    case 'anthropic': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }
      return new ChatAnthropic({
        modelName,
        maxTokens,
        anthropicApiKey: apiKey,
      });
    }
    // Future providers:
    // case 'openai': {
    //   const { ChatOpenAI } = require('@langchain/openai');
    //   return new ChatOpenAI({ modelName, maxTokens });
    // }
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

module.exports = { createModel };
