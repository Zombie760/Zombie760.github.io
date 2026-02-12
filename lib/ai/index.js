const { HumanMessage, AIMessage } = require('@langchain/core/messages');
const { getAgent } = require('./agent');
const { createModel } = require('./model');
const paths = require('../paths');
const { render_md } = require('../utils/render-md');

/**
 * Process a chat message through the LangGraph agent.
 *
 * @param {string} threadId - Conversation thread ID (from channel adapter)
 * @param {string} message - User's message text
 * @param {Array} [attachments=[]] - Normalized attachments from adapter
 * @returns {Promise<string>} AI response text
 */
async function chat(threadId, message, attachments = []) {
  const agent = getAgent();

  // Build content blocks: text + any image attachments as base64 vision
  const content = [];

  if (message) {
    content.push({ type: 'text', text: message });
  }

  for (const att of attachments) {
    if (att.category === 'image') {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${att.mimeType};base64,${att.data.toString('base64')}`,
        },
      });
    }
    // Documents: future handling
  }

  // If only text and no attachments, simplify to a string
  const messageContent = content.length === 1 && content[0].type === 'text'
    ? content[0].text
    : content;

  const result = await agent.invoke(
    { messages: [new HumanMessage({ content: messageContent })] },
    { configurable: { thread_id: threadId } }
  );

  const lastMessage = result.messages[result.messages.length - 1];

  // LangChain message content can be a string or an array of content blocks
  if (typeof lastMessage.content === 'string') {
    return lastMessage.content;
  }

  // Extract text from content blocks
  return lastMessage.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

/**
 * Process a chat message with streaming (for channels that support it).
 *
 * @param {string} threadId - Conversation thread ID
 * @param {string} message - User's message text
 * @returns {AsyncIterableIterator<string>} Stream of text chunks
 */
async function* chatStream(threadId, message) {
  const agent = getAgent();

  const stream = await agent.stream(
    { messages: [new HumanMessage(message)] },
    { configurable: { thread_id: threadId }, streamMode: 'messages' }
  );

  for await (const [message, metadata] of stream) {
    if (message.content && typeof message.content === 'string') {
      yield message.content;
    }
  }
}

/**
 * One-shot summarization with a different system prompt and no memory.
 * Used for job completion summaries sent via GitHub webhook.
 *
 * @param {object} results - Job results from webhook payload
 * @returns {Promise<string>} Summary text
 */
async function summarizeJob(results) {
  try {
    const model = createModel({ maxTokens: 1024 });
    const systemPrompt = render_md(paths.jobSummaryMd);

    const userMessage = [
      results.job ? `## Task\n${results.job}` : '',
      results.commit_message ? `## Commit Message\n${results.commit_message}` : '',
      results.changed_files?.length ? `## Changed Files\n${results.changed_files.join('\n')}` : '',
      results.status ? `## Status\n${results.status}` : '',
      results.merge_result ? `## Merge Result\n${results.merge_result}` : '',
      results.pr_url ? `## PR URL\n${results.pr_url}` : '',
      results.run_url ? `## Run URL\n${results.run_url}` : '',
      results.log ? `## Agent Log\n${results.log}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await model.invoke([
      ['system', systemPrompt],
      ['human', userMessage],
    ]);

    const text =
      typeof response.content === 'string'
        ? response.content
        : response.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('\n');

    return text.trim() || 'Job finished.';
  } catch (err) {
    console.error('Failed to summarize job:', err);
    return 'Job finished.';
  }
}

/**
 * Inject a message into a thread's memory so the agent has context
 * for future conversations (e.g., job completion summaries).
 *
 * @param {string} threadId - Conversation thread ID
 * @param {string} text - Message text to inject as an assistant message
 */
async function addToThread(threadId, text) {
  try {
    const agent = getAgent();
    await agent.updateState(
      { configurable: { thread_id: threadId } },
      { messages: [new AIMessage(text)] }
    );
  } catch (err) {
    console.error('Failed to add message to thread:', err);
  }
}

module.exports = { chat, chatStream, summarizeJob, addToThread };
