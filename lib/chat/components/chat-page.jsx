'use client';

import { useState, useEffect } from 'react';
import { AppSidebar } from './app-sidebar.js';
import { Chat } from './chat.js';
import { SidebarProvider, SidebarInset } from './ui/sidebar.js';
import { getChatMessages } from '../actions.js';

/**
 * Main chat page component.
 *
 * @param {object} props
 * @param {object|null} props.session - Auth session (null = not logged in)
 * @param {boolean} props.needsSetup - Whether setup is needed
 * @param {string} [props.chatId] - Chat ID (undefined = new chat)
 */
export function ChatPage({ session, needsSetup, chatId }) {
  const [initialMessages, setInitialMessages] = useState([]);
  const [resolvedChatId, setResolvedChatId] = useState(() => chatId || crypto.randomUUID());
  const [messagesLoaded, setMessagesLoaded] = useState(!chatId);

  // Load existing messages when chatId changes
  useEffect(() => {
    if (chatId) {
      setMessagesLoaded(false);
      setResolvedChatId(chatId);
      getChatMessages(chatId).then((dbMessages) => {
        // Convert DB messages to AI SDK UIMessage format
        const uiMessages = dbMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          parts: [{ type: 'text', text: msg.content }],
          createdAt: new Date(msg.createdAt),
        }));
        setInitialMessages(uiMessages);
        setMessagesLoaded(true);
      });
    } else {
      setInitialMessages([]);
      setResolvedChatId(crypto.randomUUID());
      setMessagesLoaded(true);
    }
  }, [chatId]);

  // If not authenticated, don't render chat (page.js handles login/setup)
  if (needsSetup || !session) {
    return null;
  }

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>
        {messagesLoaded && (
          <Chat
            key={resolvedChatId}
            chatId={resolvedChatId}
            initialMessages={initialMessages}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
