'use client';

import { useRef, useEffect, useCallback } from 'react';
import { SendIcon, StopIcon } from './icons.js';
import { cn } from '../utils.js';

export function ChatInput({ input, setInput, onSubmit, status, stop }) {
  const textareaRef = useRef(null);
  const isStreaming = status === 'streaming' || status === 'submitted';

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSubmit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-2 pb-4 md:px-4">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-muted p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground',
              'placeholder:text-muted-foreground focus:outline-none',
              'max-h-[200px]'
            )}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center justify-center rounded-lg bg-foreground p-2 text-background hover:opacity-80"
              aria-label="Stop generating"
            >
              <StopIcon size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className={cn(
                'inline-flex items-center justify-center rounded-lg p-2',
                input.trim()
                  ? 'bg-foreground text-background hover:opacity-80'
                  : 'bg-muted-foreground/20 text-muted-foreground cursor-not-allowed'
              )}
              aria-label="Send message"
            >
              <SendIcon size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
