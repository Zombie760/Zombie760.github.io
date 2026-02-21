'use client';

import { useState, useRef, useEffect } from 'react';
import { Streamdown } from 'streamdown';
import { cn } from '../utils.js';
import { SpinnerIcon, FileTextIcon, CopyIcon, CheckIcon, RefreshIcon, SquarePenIcon } from './icons.js';
import { ToolCall } from './tool-call.jsx';

export function PreviewMessage({ message, isLoading, onRetry, onEdit }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const textareaRef = useRef(null);

  // Extract text from parts (AI SDK v5+) or fall back to content
  const text =
    message.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n') ||
    message.content ||
    '';

  // Extract file parts
  const fileParts = message.parts?.filter((p) => p.type === 'file') || [];
  const imageParts = fileParts.filter((p) => p.mediaType?.startsWith('image/'));
  const otherFileParts = fileParts.filter((p) => !p.mediaType?.startsWith('image/'));
  const hasToolParts = message.parts?.some((p) => p.type?.startsWith('tool-')) || false;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleEditStart = () => {
    setEditText(text);
    setEditing(true);
  };

  const handleEditCancel = () => {
    setEditing(false);
    setEditText('');
  };

  const handleEditSubmit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== text) {
      onEdit?.(message, trimmed);
    }
    setEditing(false);
    setEditText('');
  };

  // Auto-resize and focus textarea when entering edit mode
  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
      // Move cursor to end
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [editing]);

  return (
    <div
      className={cn(
        'group flex gap-4 w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div className="flex flex-col max-w-[80%]">
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => {
                setEditText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSubmit();
                }
                if (e.key === 'Escape') {
                  handleEditCancel();
                }
              }}
              className="w-full resize-none rounded-xl border border-border bg-muted px-4 py-3 text-sm leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              rows={1}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleEditCancel}
                className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-80"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              className={cn(
                'rounded-xl px-4 py-3 text-sm leading-relaxed',
                isUser
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              {isUser ? (
                <>
                  {imageParts.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {imageParts.map((part, i) => (
                        <img
                          key={i}
                          src={part.url}
                          alt="attachment"
                          className="max-h-64 max-w-full rounded-lg object-contain"
                        />
                      ))}
                    </div>
                  )}
                  {otherFileParts.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {otherFileParts.map((part, i) => (
                        <div
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs bg-primary-foreground/20"
                        >
                          <FileTextIcon size={12} />
                          <span className="max-w-[150px] truncate">
                            {part.name || part.mediaType || 'file'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {text ? (
                    <div className="whitespace-pre-wrap break-words">{text}</div>
                  ) : null}
                </>
              ) : (
                <>
                  {message.parts?.length > 0 ? (
                    message.parts.map((part, i) => {
                      if (part.type === 'text') {
                        return <Streamdown key={i} mode={isLoading ? 'streaming' : 'static'}>{part.text}</Streamdown>;
                      }
                      if (part.type === 'file') {
                        if (part.mediaType?.startsWith('image/')) {
                          return (
                            <div key={i} className="mb-2">
                              <img src={part.url} alt="attachment" className="max-h-64 max-w-full rounded-lg object-contain" />
                            </div>
                          );
                        }
                        return (
                          <div key={i} className="mb-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs bg-foreground/10">
                            <FileTextIcon size={12} />
                            <span className="max-w-[150px] truncate">{part.name || part.mediaType || 'file'}</span>
                          </div>
                        );
                      }
                      if (part.type?.startsWith('tool-')) {
                        return <ToolCall key={part.toolCallId || i} part={part} />;
                      }
                      return null;
                    })
                  ) : text ? (
                    <Streamdown mode={isLoading ? 'streaming' : 'static'}>{text}</Streamdown>
                  ) : isLoading && !hasToolParts ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <SpinnerIcon size={14} />
                      <span>Working...</span>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {/* Action toolbar */}
            {!isLoading && text && (
              <div
                className={cn(
                  'flex gap-1 mt-1 opacity-0 transition-opacity group-hover:opacity-100',
                  isUser ? 'justify-end' : 'justify-start'
                )}
              >
                <button
                  onClick={handleCopy}
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Copy message"
                >
                  {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                </button>
                {onRetry && (
                  <button
                    onClick={() => onRetry(message)}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label="Retry"
                  >
                    <RefreshIcon size={14} />
                  </button>
                )}
                {isUser && onEdit && (
                  <button
                    onClick={handleEditStart}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label="Edit message"
                  >
                    <SquarePenIcon size={14} />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ThinkingMessage() {
  return (
    <div className="flex gap-4 w-full justify-start">
      <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        <SpinnerIcon size={14} />
        <span>Thinking...</span>
      </div>
    </div>
  );
}
