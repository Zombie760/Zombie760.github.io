const fs = require('fs');
const path = require('path');

const MAX_TELEGRAM_LENGTH = 4096;
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * Get Anthropic API key from environment or auth.json
 * @returns {string} API key
 */
function getApiKey() {
  // First check environment variable
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  // Fall back to auth.json at project root
  const authPath = path.join(__dirname, '..', '..', 'auth.json');
  if (fs.existsSync(authPath)) {
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    if (auth.anthropic?.key) {
      return auth.anthropic.key;
    }
  }

  throw new Error('No Anthropic API key found. Set ANTHROPIC_API_KEY or add to auth.json');
}

/**
 * Load system prompt from EVENT_HANDLER.md
 * @returns {string} System prompt
 */
function getSystemPrompt() {
  const promptPath = path.join(__dirname, '..', '..', 'operating_system', 'EVENT_HANDLER.md');
  if (fs.existsSync(promptPath)) {
    return fs.readFileSync(promptPath, 'utf8');
  }
  return 'You are a helpful assistant responding to Telegram messages. Keep responses concise (under 4096 characters).';
}

/**
 * Split a message into chunks that fit Telegram's limit
 * @param {string} text - Text to split
 * @returns {string[]} Array of chunks
 */
function splitMessage(text) {
  if (text.length <= MAX_TELEGRAM_LENGTH) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    let chunk = remaining.slice(0, MAX_TELEGRAM_LENGTH);

    // Try to split at last newline if we have more text
    if (remaining.length > MAX_TELEGRAM_LENGTH) {
      const lastNewline = chunk.lastIndexOf('\n');
      if (lastNewline > MAX_TELEGRAM_LENGTH * 0.5) {
        chunk = remaining.slice(0, lastNewline);
      }
    }

    chunks.push(chunk);
    remaining = remaining.slice(chunk.length).trimStart();
  }

  return chunks;
}

/**
 * Call Claude API
 * @param {Array} messages - Conversation messages
 * @param {Array} tools - Tool definitions
 * @returns {Promise<Object>} API response
 */
async function callClaude(messages, tools) {
  const apiKey = getApiKey();
  const model = process.env.EVENT_HANDLER_MODEL || DEFAULT_MODEL;
  const systemPrompt = getSystemPrompt();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools: tools.length > 0 ? tools : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Process a conversation turn with Claude, handling tool calls
 * @param {string} userMessage - User's message
 * @param {Array} history - Conversation history
 * @param {Array} toolDefinitions - Available tools
 * @param {Object} toolExecutors - Tool executor functions
 * @returns {Promise<{response: string, history: Array}>}
 */
async function chat(userMessage, history, toolDefinitions, toolExecutors) {
  // Add user message to history
  const messages = [...history, { role: 'user', content: userMessage }];

  let response = await callClaude(messages, toolDefinitions);
  let assistantContent = response.content;

  // Add assistant response to history
  messages.push({ role: 'assistant', content: assistantContent });

  // Handle tool use loop
  while (response.stop_reason === 'tool_use') {
    const toolResults = [];

    for (const block of assistantContent) {
      if (block.type === 'tool_use') {
        const executor = toolExecutors[block.name];
        let result;

        if (executor) {
          try {
            result = await executor(block.input);
          } catch (err) {
            result = { error: err.message };
          }
        } else {
          result = { error: `Unknown tool: ${block.name}` };
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Add tool results to messages
    messages.push({ role: 'user', content: toolResults });

    // Get next response from Claude
    response = await callClaude(messages, toolDefinitions);
    assistantContent = response.content;

    // Add new assistant response to history
    messages.push({ role: 'assistant', content: assistantContent });
  }

  // Extract text response
  const textBlocks = assistantContent.filter((block) => block.type === 'text');
  const responseText = textBlocks.map((block) => block.text).join('\n');

  return {
    response: responseText,
    history: messages,
  };
}

module.exports = {
  chat,
  splitMessage,
  getApiKey,
  getSystemPrompt,
};
