'use client';

import { useEffect, useState } from 'react';
import { SidebarHistoryItem } from './sidebar-history-item.js';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu } from './ui/sidebar.js';
import { useChatNav } from './chat-nav-context.js';
import { getChats, deleteChat } from '../actions.js';

function groupChatsByDate(chats) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7Days = new Date(today.getTime() - 7 * 86400000);
  const last30Days = new Date(today.getTime() - 30 * 86400000);

  const groups = {
    Today: [],
    Yesterday: [],
    'Last 7 Days': [],
    'Last 30 Days': [],
    Older: [],
  };

  for (const chat of chats) {
    const date = new Date(chat.updatedAt);
    if (date >= today) {
      groups.Today.push(chat);
    } else if (date >= yesterday) {
      groups.Yesterday.push(chat);
    } else if (date >= last7Days) {
      groups['Last 7 Days'].push(chat);
    } else if (date >= last30Days) {
      groups['Last 30 Days'].push(chat);
    } else {
      groups.Older.push(chat);
    }
  }

  return groups;
}

export function SidebarHistory() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const { activeChatId, navigateToChat } = useChatNav();

  const loadChats = async () => {
    try {
      const result = await getChats();
      setChats(result);
    } catch (err) {
      console.error('Failed to load chats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load chats on mount and refresh when navigating between pages
  useEffect(() => {
    loadChats();
  }, [activeChatId]);

  // Reload when chats change (new chat created or title updated)
  useEffect(() => {
    const handler = () => loadChats();
    window.addEventListener('chatsupdated', handler);
    return () => window.removeEventListener('chatsupdated', handler);
  }, []);

  const handleDelete = async (chatId) => {
    const { success } = await deleteChat(chatId);
    if (success) {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (chatId === activeChatId) {
        navigateToChat(null);
      }
    }
  };

  if (loading && chats.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex flex-col gap-2 px-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-md bg-border/50" />
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (chats.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <p className="px-4 py-2 text-sm text-muted-foreground">
            No chats yet. Start a conversation!
          </p>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const grouped = groupChatsByDate(chats);

  return (
    <>
      {Object.entries(grouped).map(
        ([label, groupChats]) =>
          groupChats.length > 0 && (
            <SidebarGroup key={label}>
              <SidebarGroupLabel>{label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {groupChats.map((chat) => (
                    <SidebarHistoryItem
                      key={chat.id}
                      chat={chat}
                      isActive={chat.id === activeChatId}
                      onDelete={handleDelete}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
      )}
    </>
  );
}
