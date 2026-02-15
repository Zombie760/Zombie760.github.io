import { auth } from '../auth/index.js';
import { chatStream } from '../ai/index.js';

/**
 * POST handler for /api/chat — streaming chat with session auth.
 * Dedicated route handler separate from the catch-all api/index.js.
 */
export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { messages, chatId: rawChatId } = body;

  if (!messages?.length) {
    return Response.json({ error: 'No messages' }, { status: 400 });
  }

  // Get the last user message — AI SDK v5 sends UIMessage[] with parts
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) {
    return Response.json({ error: 'No user message' }, { status: 400 });
  }

  // Extract text from message parts (AI SDK v5+) or fall back to content
  let userText =
    lastUserMessage.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n') ||
    lastUserMessage.content ||
    '';

  // Extract file parts from message
  const fileParts = lastUserMessage.parts?.filter((p) => p.type === 'file') || [];
  const attachments = [];

  for (const part of fileParts) {
    const { mediaType, url } = part;
    if (!mediaType || !url) continue;

    if (mediaType.startsWith('image/') || mediaType === 'application/pdf') {
      // Images and PDFs → pass as visual attachments for the LLM
      attachments.push({ category: 'image', mimeType: mediaType, dataUrl: url });
    } else if (mediaType.startsWith('text/') || mediaType === 'application/json') {
      // Text files → decode base64 data URL and inline into message text
      try {
        const base64Data = url.split(',')[1];
        const textContent = Buffer.from(base64Data, 'base64').toString('utf-8');
        const fileName = part.name || 'file';
        userText += `\n\nFile: ${fileName}\n\`\`\`\n${textContent}\n\`\`\``;
      } catch (e) {
        console.error('Failed to decode text file:', e);
      }
    }
  }

  if (!userText.trim() && attachments.length === 0) {
    return Response.json({ error: 'Empty message' }, { status: 400 });
  }

  // Map web channel to thread_id — AI layer handles DB persistence
  const threadId = rawChatId || crypto.randomUUID();
  const { createUIMessageStream, createUIMessageStreamResponse } = await import('ai');

  const stream = createUIMessageStream({
    onError: (error) => {
      console.error('Chat stream error:', error);
      return error?.message || 'An error occurred while processing your message.';
    },
    execute: async ({ writer }) => {
      // chatStream handles: save user msg, invoke agent, save assistant msg, auto-title
      const chunks = chatStream(threadId, userText, attachments, {
        userId: session.user.id,
      });

      // Signal start of assistant message
      writer.write({ type: 'start' });

      const textId = crypto.randomUUID();
      let textStarted = false;

      for await (const chunk of chunks) {
        if (!textStarted) {
          writer.write({ type: 'text-start', id: textId });
          textStarted = true;
        }
        writer.write({ type: 'text-delta', id: textId, delta: chunk });
      }

      if (textStarted) {
        writer.write({ type: 'text-end', id: textId });
      }

      // Signal end of assistant message
      writer.write({ type: 'finish' });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
