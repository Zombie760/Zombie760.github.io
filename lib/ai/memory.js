const path = require('path');
const fs = require('fs');
const paths = require('../paths');

/**
 * Create a LangGraph checkpointer based on environment configuration.
 *
 * Config env vars:
 *   MEMORY_BACKEND — "memory" (default), "sqlite"
 *   MEMORY_PATH    — SQLite file path (default: "data/memory.sqlite")
 *
 * @returns {import('@langchain/langgraph').BaseCheckpointSaver}
 */
function createCheckpointer() {
  const backend = process.env.MEMORY_BACKEND || 'memory';

  switch (backend) {
    case 'memory': {
      const { MemorySaver } = require('@langchain/langgraph');
      return new MemorySaver();
    }
    case 'sqlite': {
      const { SqliteSaver } = require('@langchain/langgraph-checkpoint-sqlite');
      const dbPath = process.env.MEMORY_PATH || path.join(paths.dataDir, 'memory.sqlite');

      // Ensure the data directory exists
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      return SqliteSaver.fromConnString(dbPath);
    }
    default:
      throw new Error(`Unknown memory backend: ${backend}`);
  }
}

module.exports = { createCheckpointer };
