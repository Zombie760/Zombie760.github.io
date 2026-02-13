'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PlusIcon, TrashIcon } from './icons.js';
import { SidebarHistory } from './sidebar-history.js';
import { SidebarUserNav } from './sidebar-user-nav.js';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from './ui/sidebar.js';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.js';
import { deleteAllChats } from '../actions.js';

export function AppSidebar({ user }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const [showDeleteAll, setShowDeleteAll] = useState(false);

  const handleDeleteAll = async () => {
    if (!confirm('Delete all chats? This cannot be undone.')) return;
    await deleteAllChats();
    setShowDeleteAll(false);
    router.push('/');
  };

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row items-center justify-between">
            <a
              className="flex flex-row items-center gap-3 cursor-pointer"
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setOpenMobile(false);
                router.push('/');
              }}
            >
              <span className="rounded-md px-2 font-semibold text-lg hover:bg-background">
                Chat
              </span>
            </a>
            <div className="flex flex-row gap-1">
              {user && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={handleDeleteAll}
                      type="button"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent align="end" className="hidden md:block">
                    Delete All Chats
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={() => {
                      setOpenMobile(false);
                      router.push('/');
                    }}
                    type="button"
                  >
                    <PlusIcon size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent align="end" className="hidden md:block">
                  New Chat
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory />
      </SidebarContent>
      <SidebarFooter>
        {user && <SidebarUserNav user={user} />}
      </SidebarFooter>
    </Sidebar>
  );
}
