'use client';

import { cn } from '../utils.js';
import { SpinnerIcon } from './icons.js';

export function PreviewMessage({ message, isLoading }) {
  const isUser = message.role === 'user';

  // Extract text from parts (AI SDK v5+) or fall back to content
  const text =
    message.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n') ||
    message.content ||
    '';

  return (
    <div
      className={cn(
        'flex gap-4 w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        <div className="whitespace-pre-wrap break-words">{text}</div>
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
