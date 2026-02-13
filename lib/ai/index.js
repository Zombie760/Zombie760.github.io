import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { getAgent } from './agent.js';
import { createModel } from './model.js';
import { jobSummaryMd } from '../paths.js';
import { render_md } from '../utils/render-md.js';
import { getChatById, createChat, saveMessage, updateChatTitle } from '../db/chats.js';

/**
 * Ensure a chat exists in the DB and save a message.
 * Centralized so every channel gets persistence automatically.
 *
 * @param {string} threadId - Chat/thread ID
 * @param {string} role - 'user' or 'assistant'
 * @param {string} text - Message text
 * @param {object} [options] - { userId, chatTitle }
 */
function persistMessage(threadId, role, text, options = {}) {
  try {
    if (!getChatById(threadId)) {
      createChat(options.userId || 'unknown', options.chatTitle || 'New Chat', threadId);
    }
    saveMessage(threadId, role, text);
  } catch (err) {
    // DB persistence is best-effort — don't break chat if DB fails
    console.error('Failed to persist message:', err);
  }
}

/**
 * Process a chat message through the LangGraph agent.
 * Saves user and assistant messages to the DB automatically.
 *
 * @param {string} threadId - Conversation thread ID (from channel adapter)
 * @param {string} message - User's message text
 * @param {Array} [attachments=[]] - Normalized attachments from adapter
 * @param {object} [options] - { userId, chatTitle } for DB persistence
 * @returns {Promise<string>} AI response text
 */
async function chat(threadId, message, attachments = [], options = {}) {
  const agent = await getAgent();

  // Save user message to DB
  persistMessage(threadId, 'user', message || '[attachment]', options);

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
  let response;
  if (typeof lastMessage.content === 'string') {
    response = lastMessage.content;
  } else {
    response = lastMessage.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }

  // Save assistant response to DB
  persistMessage(threadId, 'assistant', response, options);

  // Auto-generate title for new chats
  if (options.userId && message) {
    autoTitle(threadId, message).catch(() => {});
  }

  return response;
}

/**
 * Process a chat message with streaming (for channels that support it).
 * Saves user and assistant messages to the DB automatically.
 *
 * @param {string} threadId - Conversation thread ID
 * @param {string} message - User's message text
 * @param {object} [options] - { userId, chatTitle } for DB persistence
 * @returns {AsyncIterableIterator<string>} Stream of text chunks
 */
async function* chatStream(threadId, message, options = {}) {
  const agent = await getAgent();

  // Save user message to DB
  persistMessage(threadId, 'user', message, options);

  try {
    const stream = await agent.stream(
      { messages: [new HumanMessage({ content: message })] },
      { configurable: { thread_id: threadId }, streamMode: 'messages' }
    );

    let fullText = '';

    for await (const event of stream) {
      // streamMode: 'messages' yields [message, metadata] tuples
      const msg = Array.isArray(event) ? event[0] : event;
      const isAI = msg._getType?.() === 'ai';
      if (!isAI) continue;

      // Content can be a string or an array of content blocks
      let text = '';
      if (typeof msg.content === 'string') {
        text = msg.content;
      } else if (Array.isArray(msg.content)) {
        text = msg.content
          .filter((b) => b.type === 'text' && b.text)
          .map((b) => b.text)
          .join('');
      }

      if (text) {
        fullText += text;
        yield text;
      }
    }

    // Save assistant response to DB
    if (fullText) {
      persistMessage(threadId, 'assistant', fullText, options);
    }

    // Auto-generate title for new chats
    if (options.userId && message) {
      autoTitle(threadId, message).catch(() => {});
    }
  } catch (err) {
    console.error('[chatStream] error:', err);
    throw err;
  }
}

/**
 * Auto-generate a chat title from the first user message (fire-and-forget).
 */
async function autoTitle(threadId, firstMessage) {
  try {
    const chat = getChatById(threadId);
    if (!chat || chat.title !== 'New Chat') return;

    const model = await createModel({ maxTokens: 50 });
    const response = await model.invoke([
      ['system', 'Generate a short (3-6 word) title for this chat based on the user\'s first message. Return ONLY the title, nothing else.'],
      ['human', firstMessage],
    ]);
    const title = typeof response.content === 'string'
      ? response.content
      : response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const cleaned = title.replace(/^["']+|["']+$/g, '').trim();
    if (cleaned) {
      updateChatTitle(threadId, cleaned);
    }
  } catch (err) {
    // Title generation is best-effort
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
    const model = await createModel({ maxTokens: 1024 });
    const systemPrompt = render_md(jobSummaryMd);

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
    const agent = await getAgent();
    await agent.updateState(
      { configurable: { thread_id: threadId } },
      { messages: [new AIMessage(text)] }
    );
  } catch (err) {
    console.error('Failed to add message to thread:', err);
  }
}

export { chat, chatStream, summarizeJob, addToThread, persistMessage };
