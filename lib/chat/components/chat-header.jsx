'use client';

import { useRouter } from 'next/navigation';
import { SidebarTrigger, useSidebar } from './ui/sidebar.js';
import { PlusIcon } from './icons.js';
import { cn } from '../utils.js';

export function ChatHeader({ chatId }) {
  const router = useRouter();
  const { open, isMobile } = useSidebar();

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2 z-10">
      <SidebarTrigger />

      {(!open || isMobile) && (
        <button
          className={cn(
            'ml-auto inline-flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1 text-sm',
            'hover:bg-muted text-foreground md:ml-0'
          )}
          onClick={() => {
            router.push('/');
            router.refresh();
          }}
        >
          <PlusIcon size={14} />
          <span className="md:sr-only">New Chat</span>
        </button>
      )}
    </header>
  );
}
