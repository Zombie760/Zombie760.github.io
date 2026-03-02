'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SidebarTrigger } from './ui/sidebar.js';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu.js';
import { ConfirmDialog } from './ui/confirm-dialog.js';
import { ChevronDownIcon, StarIcon, StarFilledIcon, PencilIcon, TrashIcon } from './icons.js';
import { getChatTitle, getChatTitleByWorkspace, getChatMeta, renameChat, deleteChat, starChat } from '../actions.js';
import { useChatNav } from './chat-nav-context.js';

export function ChatHeader({ chatId, workspaceId }) {
  const [title, setTitle] = useState(null);
  const [starred, setStarred] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const inputRef = useRef(null);
  const nav = useChatNav();

  // Whether to show the dropdown and inline-edit features
  const showControls = chatId && !workspaceId && title && title !== 'New Chat';

  const fetchMeta = useCallback(() => {
    if (workspaceId) {
      getChatTitleByWorkspace(workspaceId)
        .then((t) => { if (t && t !== 'New Chat') setTitle(t); })
        .catch(() => {});
      return;
    }
    if (!chatId) return;
    getChatMeta(chatId)
      .then((meta) => {
        if (meta?.title && meta.title !== 'New Chat') {
          setTitle(meta.title);
          setStarred(meta.starred || 0);
        }
      })
      .catch(() => {});
  }, [chatId, workspaceId]);

  useEffect(() => {
    fetchMeta();
    const handler = () => fetchMeta();
    window.addEventListener('chatsupdated', handler);
    return () => window.removeEventListener('chatsupdated', handler);
  }, [fetchMeta]);

  // Auto-focus and select when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const enterEditMode = () => {
    setEditValue(title || '');
    setIsEditing(true);
  };

  const saveEdit = async () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === title) return;
    setTitle(trimmed); // optimistic
    await renameChat(chatId, trimmed);
    window.dispatchEvent(new Event('chatsupdated'));
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const handleStar = async () => {
    const newStarred = starred ? 0 : 1;
    setStarred(newStarred); // optimistic
    await starChat(chatId);
    window.dispatchEvent(new Event('chatsupdated'));
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    await deleteChat(chatId);
    window.dispatchEvent(new Event('chatsupdated'));
    nav?.navigateToChat?.(null);
  };

  return (
    <>
      <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2 z-10">
        {/* Mobile-only: open sidebar sheet */}
        <div className="md:hidden">
          <SidebarTrigger />
        </div>

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            onBlur={saveEdit}
            className="text-base font-medium text-foreground bg-transparent border-b border-input outline-none truncate min-w-0 flex-1"
          />
        ) : (
          <h1
            className={`text-base font-medium text-muted-foreground truncate ${showControls ? 'cursor-pointer hover:text-foreground transition-colors' : ''}`}
            onClick={showControls ? enterEditMode : undefined}
          >
            {title || '\u00A0'}
          </h1>
        )}

        {showControls && !isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <ChevronDownIcon size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleStar}>
                {starred ? <StarFilledIcon size={14} /> : <StarIcon size={14} />}
                <span>{starred ? 'Unstar' : 'Star'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={enterEditMode}>
                <PencilIcon size={14} />
                <span>Rename</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)}>
                <TrashIcon size={14} />
                <span className="text-destructive">Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete chat?"
        description="This will permanently delete this chat and all its messages."
        confirmLabel="Delete"
      />
    </>
  );
}
