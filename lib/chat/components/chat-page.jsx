'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppSidebar } from './app-sidebar.js';
import { Chat } from './chat.js';
import { SidebarProvider, SidebarInset } from './ui/sidebar.js';
import { ChatNavProvider } from './chat-nav-context.js';
import { getChatMessages } from '../actions.js';

/**
 * Main chat page component.
 *
 * @param {object} props
 * @param {object|null} props.session - Auth session (null = not logged in)
 * @param {boolean} props.needsSetup - Whether setup is needed
 * @param {string} [props.chatId] - Chat ID from URL (only used for initial mount)
 */
export function ChatPage({ session, needsSetup, chatId }) {
  const [activeChatId, setActiveChatId] = useState(chatId || null);
  const [resolvedChatId, setResolvedChatId] = useState(() => chatId ? null : crypto.randomUUID());
  const [initialMessages, setInitialMessages] = useState([]);

  const navigateToChat = useCallback((id) => {
    if (id) {
      window.history.pushState({}, '', `/chat/${id}`);
    } else {
      window.history.pushState({}, '', '/');
    }
    // Clear current chat immediately — unmounts Chat via the
    // {resolvedChatId && ...} guard before the effect runs
    setResolvedChatId(null);
    setInitialMessages([]);
    setActiveChatId(id || null);
  }, []);

  // Browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const match = window.location.pathname.match(/^\/chat\/(.+)/);
      setActiveChatId(match ? match[1] : null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Load messages when activeChatId changes
  useEffect(() => {
    if (activeChatId) {
      getChatMessages(activeChatId).then((dbMessages) => {
        if (dbMessages.length === 0) {
          // Stale chat (e.g. after login with old UUID) — start fresh
          setInitialMessages([]);
          setResolvedChatId(crypto.randomUUID());
          window.history.replaceState({}, '', '/');
          return;
        }
        const uiMessages = dbMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          parts: [{ type: 'text', text: msg.content }],
          createdAt: new Date(msg.createdAt),
        }));
        setInitialMessages(uiMessages);
        setResolvedChatId(activeChatId);
      });
    } else {
      setInitialMessages([]);
      setResolvedChatId(crypto.randomUUID());
    }
  }, [activeChatId]);

  if (needsSetup || !session) {
    return null;
  }

  return (
    <ChatNavProvider value={{ activeChatId: resolvedChatId, navigateToChat }}>
      <SidebarProvider>
        <AppSidebar user={session.user} />
        <SidebarInset>
          {resolvedChatId && (
            <Chat
              key={resolvedChatId}
              chatId={resolvedChatId}
              initialMessages={initialMessages}
            />
          )}
        </SidebarInset>
      </SidebarProvider>
    </ChatNavProvider>
  );
}
