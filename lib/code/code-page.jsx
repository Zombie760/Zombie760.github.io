'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AppSidebar } from '../chat/components/app-sidebar.js';
import { SidebarProvider, SidebarInset } from '../chat/components/ui/sidebar.js';
import { ChatNavProvider } from '../chat/components/chat-nav-context.js';
import { ChatHeader } from '../chat/components/chat-header.js';
import { ConfirmDialog } from '../chat/components/ui/confirm-dialog.js';
import { ensureCodeWorkspaceContainer, closeInteractiveMode } from './actions.js';

const TerminalView = dynamic(() => import('./terminal-view.js'), { ssr: false });

export default function CodePage({ session, codeWorkspaceId }) {
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const handleCloseSession = async () => {
    const result = await closeInteractiveMode(codeWorkspaceId);
    if (result?.success) {
      window.location.href = result.chatId ? `/chat/${result.chatId}` : '/';
    }
  };

  return (
    <ChatNavProvider value={{ activeChatId: null, navigateToChat: (id) => { window.location.href = id ? `/chat/${id}` : '/'; } }}>
      <SidebarProvider>
        <AppSidebar user={session.user} />
        <SidebarInset>
          <div className="flex h-svh flex-col overflow-hidden">
            <div style={{ display: 'flex', alignItems: 'center', paddingRight: 20 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <ChatHeader workspaceId={codeWorkspaceId} />
              </div>
              <button
                onClick={() => setShowCloseConfirm(true)}
                title="Close Session"
                style={{ width: 22, height: 22, flexShrink: 0 }}
                className="flex items-center justify-center rounded border-2 border-destructive/40 hover:bg-destructive/10 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </div>
            <TerminalView codeWorkspaceId={codeWorkspaceId} ensureContainer={ensureCodeWorkspaceContainer} onCloseSession={handleCloseSession} />
          </div>
          <ConfirmDialog
            open={showCloseConfirm}
            title="Close session?"
            description="This will destroy the container and any uncommitted work. Commit and merge your changes first."
            confirmLabel="Close Session"
            variant="destructive"
            onConfirm={() => { setShowCloseConfirm(false); handleCloseSession(); }}
            onCancel={() => setShowCloseConfirm(false)}
          />
        </SidebarInset>
      </SidebarProvider>
    </ChatNavProvider>
  );
}
