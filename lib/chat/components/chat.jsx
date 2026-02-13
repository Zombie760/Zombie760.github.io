'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Messages } from './messages.js';
import { ChatInput } from './chat-input.js';
import { ChatHeader } from './chat-header.js';

export function Chat({ chatId, initialMessages = [] }) {
  const [input, setInput] = useState('');
  const hasNavigated = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { chatId },
      }),
    [chatId]
  );

  const {
    messages,
    status,
    stop,
    error,
    sendMessage,
  } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onError: (err) => console.error('Chat error:', err),
  });

  // After first exchange, update URL and notify sidebar
  useEffect(() => {
    if (!hasNavigated.current && messages.length >= 2 && !window.location.pathname.includes(chatId)) {
      hasNavigated.current = true;
      window.history.replaceState({}, '', `/chat/${chatId}`);
      window.dispatchEvent(new Event('chatcreated'));
    }
  }, [messages.length, chatId]);

  const handleSend = () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    sendMessage({ text });
  };

  return (
    <div className="flex h-svh flex-col">
      <ChatHeader chatId={chatId} />
      <Messages messages={messages} status={status} />
      {error && (
        <div className="mx-auto w-full max-w-4xl px-2 md:px-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            Something went wrong. Please try again.
          </div>
        </div>
      )}
      <ChatInput
        input={input}
        setInput={setInput}
        onSubmit={handleSend}
        status={status}
        stop={stop}
      />
    </div>
  );
}
