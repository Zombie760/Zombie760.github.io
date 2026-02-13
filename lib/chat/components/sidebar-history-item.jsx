'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MessageIcon, TrashIcon } from './icons.js';
import { SidebarMenuButton, SidebarMenuItem, useSidebar } from './ui/sidebar.js';
import { cn } from '../utils.js';

export function SidebarHistoryItem({ chat, isActive, onDelete }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const [showDelete, setShowDelete] = useState(false);

  return (
    <SidebarMenuItem>
      <div
        className="relative group"
        onMouseEnter={() => setShowDelete(true)}
        onMouseLeave={() => setShowDelete(false)}
      >
        <SidebarMenuButton
          isActive={isActive}
          onClick={() => {
            router.push(`/chat/${chat.id}`);
            setOpenMobile(false);
          }}
        >
          <MessageIcon size={14} />
          <span className="truncate flex-1">{chat.title}</span>
        </SidebarMenuButton>

        {showDelete && (
          <button
            className={cn(
              'absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1',
              'text-muted-foreground hover:text-destructive hover:bg-muted'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(chat.id);
            }}
            aria-label="Delete chat"
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>
    </SidebarMenuItem>
  );
}
