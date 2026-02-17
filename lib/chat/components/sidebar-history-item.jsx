'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageIcon, TrashIcon, MoreHorizontalIcon, StarIcon, StarFilledIcon, PencilIcon } from './icons.js';
import { SidebarMenuButton, SidebarMenuItem, useSidebar } from './ui/sidebar.js';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from './ui/dropdown-menu.js';
import { ConfirmDialog } from './ui/confirm-dialog.js';
import { useChatNav } from './chat-nav-context.js';
import { cn } from '../utils.js';

export function SidebarHistoryItem({ chat, isActive, onDelete, onStar, onRename }) {
  const { navigateToChat } = useChatNav();
  const { setOpenMobile } = useSidebar();
  const [hovered, setHovered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title || '');
  const inputRef = useRef(null);

  const showMenu = hovered || dropdownOpen;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startRename = () => {
    setEditTitle(chat.title || '');
    setEditing(true);
  };

  const saveRename = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== chat.title) {
      onRename(chat.id, trimmed);
    }
    setEditing(false);
  };

  const cancelRename = () => {
    setEditing(false);
    setEditTitle(chat.title || '');
  };

  return (
    <SidebarMenuItem>
      <div
        className="relative group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {editing ? (
          <div className="flex items-center gap-2 px-2 py-1">
            <MessageIcon size={14} />
            <input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename();
                if (e.key === 'Escape') cancelRename();
              }}
              onBlur={saveRename}
              className="flex-1 min-w-0 text-sm bg-background border border-input rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ) : (
          <SidebarMenuButton
            isActive={isActive}
            onClick={() => {
              navigateToChat(chat.id);
              setOpenMobile(false);
            }}
          >
            <MessageIcon size={14} />
            <span
              className="truncate flex-1"
              onDoubleClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                startRename();
              }}
            >
              {chat.title}
            </span>
          </SidebarMenuButton>
        )}

        {!editing && (
          <div className={cn(
            'absolute right-1 top-1/2 -translate-y-1/2 z-10',
            showMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}>
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger>
                <button
                  className={cn(
                    'rounded-md p-1',
                    'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  aria-label="Chat options"
                >
                  <MoreHorizontalIcon size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onStar(chat.id);
                  }}
                >
                  {chat.starred ? <StarFilledIcon size={14} /> : <StarIcon size={14} />}
                  {chat.starred ? 'Unstar' : 'Star'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename();
                  }}
                >
                  <PencilIcon size={14} />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(true);
                  }}
                >
                  <TrashIcon size={14} />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete chat?"
        description="This will permanently delete this chat and all its messages."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete(chat.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </SidebarMenuItem>
  );
}
