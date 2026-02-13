const { ChatAnthropic } = require('@langchain/anthropic');

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  google: 'gemini-2.5-pro',
};

/**
 * Create a LangChain chat model based on environment configuration.
 *
 * Config env vars:
 *   LLM_PROVIDER    — "anthropic" (default), "openai", "google"
 *   LLM_MODEL       — Model name override (e.g. "claude-sonnet-4-20250514")
 *   ANTHROPIC_API_KEY — Required for anthropic provider
 *   OPENAI_API_KEY   — Required for openai provider
 *   GOOGLE_API_KEY   — Required for google provider
 *
 * @param {object} [options]
 * @param {number} [options.maxTokens=4096] - Max tokens for the response
 * @returns {import('@langchain/core/language_models/chat_models').BaseChatModel}
 */
function createModel(options = {}) {
  const provider = process.env.LLM_PROVIDER || 'anthropic';
  const modelName = process.env.LLM_MODEL || DEFAULT_MODELS[provider] || DEFAULT_MODELS.anthropic;
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
    case 'openai': {
      const { ChatOpenAI } = require('@langchain/openai');
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }
      return new ChatOpenAI({
        modelName,
        maxTokens,
        openAIApiKey: apiKey,
      });
    }
    case 'google': {
      const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('GOOGLE_API_KEY environment variable is required');
      }
      return new ChatGoogleGenerativeAI({
        modelName,
        maxOutputTokens: maxTokens,
        apiKey,
      });
    }
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

module.exports = { createModel };
