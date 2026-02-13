const path = require('path');

/**
 * Next.js config wrapper for thepopebot.
 * Enables instrumentation hook for cron scheduling on server start.
 *
 * Usage in user's next.config.mjs:
 *   import { withThepopebot } from 'thepopebot/config';
 *   export default withThepopebot({});
 *
 * @param {Object} nextConfig - User's Next.js config
 * @returns {Object} Enhanced Next.js config
 */
function withThepopebot(nextConfig = {}) {
  return {
    ...nextConfig,
    // Ensure server-only packages aren't bundled for client
    serverExternalPackages: [
      ...(nextConfig.serverExternalPackages || []),
      'thepopebot',
      'grammy',
      '@grammyjs/parse-mode',
      'node-cron',
      'uuid',
      '@langchain/langgraph',
      '@langchain/anthropic',
      '@langchain/openai',
      '@langchain/google-genai',
      '@langchain/core',
      'zod',
      'better-sqlite3',
    ],
  };
}

module.exports = { withThepopebot };
