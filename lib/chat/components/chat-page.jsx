'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppSidebar } from './app-sidebar.js';
import { Chat } from './chat.js';
import { SidebarProvider, SidebarInset } from './ui/sidebar.js';
import { ChatNavProvider } from './chat-nav-context.js';
import { getChatMessages, getChatMeta, getWorkspace, getFeatureFlags } from '../actions.js';
import { v4 as uuidv4 } from 'uuid';

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
  const [resolvedChatId, setResolvedChatId] = useState(() => chatId ? null : uuidv4());
  const [initialMessages, setInitialMessages] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [featureFlags, setFeatureFlags] = useState({});

  const navigateToChat = useCallback((id) => {
    if (id) {
      window.history.pushState({}, '', `/chat/${id}`);
      setResolvedChatId(null);
      setInitialMessages([]);
      setWorkspace(null);
      setActiveChatId(id);
    } else {
      window.history.pushState({}, '', '/');
      setInitialMessages([]);
      setWorkspace(null);
      setActiveChatId(null);
      setResolvedChatId(uuidv4());
    }
  }, []);

  // Load feature flags once
  useEffect(() => {
    getFeatureFlags().then(setFeatureFlags).catch(() => {});
  }, []);

  // Browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const match = window.location.pathname.match(/^\/chat\/(.+)/);
      if (match) {
        setResolvedChatId(null);
        setInitialMessages([]);
        setWorkspace(null);
        setActiveChatId(match[1]);
      } else {
        setInitialMessages([]);
        setWorkspace(null);
        setActiveChatId(null);
        setResolvedChatId(uuidv4());
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Load messages and workspace data when activeChatId changes
  useEffect(() => {
    if (activeChatId) {
      getChatMessages(activeChatId).then(async (dbMessages) => {
        if (dbMessages.length === 0) {
          // Stale chat (e.g. after login with old UUID) — start fresh
          setInitialMessages([]);
          setWorkspace(null);
          setResolvedChatId(uuidv4());
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

        // Check if this is a code chat
        try {
          const meta = await getChatMeta(activeChatId);
          if (meta?.claudeWorkspaceId) {
            const ws = await getWorkspace(meta.claudeWorkspaceId);
            setWorkspace(ws);
          } else {
            setWorkspace(null);
          }
        } catch {
          setWorkspace(null);
        }

        setResolvedChatId(activeChatId);
      });
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
              workspace={workspace}
              featureFlags={featureFlags}
            />
          )}
        </SidebarInset>
      </SidebarProvider>
    </ChatNavProvider>
  );
}
