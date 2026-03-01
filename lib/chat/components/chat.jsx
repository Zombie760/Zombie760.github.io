'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Messages } from './messages.js';
import { ChatInput } from './chat-input.js';
import { ChatHeader } from './chat-header.js';
import { Greeting } from './greeting.js';
import { CodeModeToggle } from './code-mode-toggle.js';
import { getRepositories, getBranches } from '../actions.js';

export function Chat({ chatId, initialMessages = [], workspace = null, featureFlags = {} }) {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const hasNavigated = useRef(false);
  const [codeMode, setCodeMode] = useState(!!workspace);
  const [repo, setRepo] = useState(workspace?.repo || '');
  const [branch, setBranch] = useState(workspace?.branch || '');

  const codeModeRef = useRef({ codeMode, repo, branch });
  codeModeRef.current = { codeMode, repo, branch };

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/stream/chat',
        body: () => ({
          chatId,
          ...(codeModeRef.current.codeMode && codeModeRef.current.repo && codeModeRef.current.branch
            ? { codeMode: true, repo: codeModeRef.current.repo, branch: codeModeRef.current.branch }
            : {}),
        }),
      }),
    [chatId]
  );

  const {
    messages,
    status,
    stop,
    error,
    sendMessage,
    regenerate,
    setMessages,
  } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onError: (err) => console.error('Chat error:', err),
  });

  // After first message sent, update URL and notify sidebar
  useEffect(() => {
    if (!hasNavigated.current && messages.length >= 1 && status !== 'ready' && window.location.pathname !== `/chat/${chatId}`) {
      hasNavigated.current = true;
      window.history.replaceState({}, '', `/chat/${chatId}`);
      window.dispatchEvent(new Event('chatsupdated'));
      // Dispatch again after delay to pick up async title update
      setTimeout(() => window.dispatchEvent(new Event('chatsupdated')), 5000);
    }
  }, [messages.length, status, chatId]);

  const handleSend = () => {
    if (!input.trim() && files.length === 0) return;
    const text = input;
    const currentFiles = files;
    setInput('');
    setFiles([]);

    if (currentFiles.length === 0) {
      sendMessage({ text });
    } else {
      // Build FileUIPart[] from pre-read data URLs (File[] isn't a valid type)
      const fileParts = currentFiles.map((f) => ({
        type: 'file',
        mediaType: f.file.type || 'text/plain',
        url: f.previewUrl,
        filename: f.file.name,
      }));
      sendMessage({ text: text || undefined, files: fileParts });
    }
  };

  const handleRetry = useCallback((message) => {
    if (message.role === 'assistant') {
      regenerate({ messageId: message.id });
    } else {
      // User message — find the next assistant message and regenerate it
      const idx = messages.findIndex((m) => m.id === message.id);
      const nextAssistant = messages.slice(idx + 1).find((m) => m.role === 'assistant');
      if (nextAssistant) {
        regenerate({ messageId: nextAssistant.id });
      } else {
        // No assistant response yet — extract text and resend
        const text =
          message.parts
            ?.filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join('\n') ||
          message.content ||
          '';
        if (text.trim()) {
          sendMessage({ text });
        }
      }
    }
  }, [messages, regenerate, sendMessage]);

  const handleEdit = useCallback((message, newText) => {
    const idx = messages.findIndex((m) => m.id === message.id);
    if (idx === -1) return;
    // Truncate conversation to before this message, then send edited text
    setMessages(messages.slice(0, idx));
    sendMessage({ text: newText });
  }, [messages, setMessages, sendMessage]);

  // Workspace is launched if containerName is set or start_coding tool was called
  const isWorkspaceLaunched = !!workspace?.containerName || messages.some((m) =>
    m.parts?.some((p) => p.type === 'tool-invocation' && p.toolName === 'start_coding' && p.state === 'output-available')
  );

  // In code mode, disable send until repo+branch selected
  const codeModeCanSend = !codeMode || (!!repo && !!branch);

  const codeModeToggle = (
    <CodeModeToggle
      enabled={codeMode}
      onToggle={setCodeMode}
      repo={repo}
      onRepoChange={setRepo}
      branch={branch}
      onBranchChange={setBranch}
      locked={messages.length > 0}
      featureEnabled={!!featureFlags.claudeWorkspace}
      getRepositories={getRepositories}
      getBranches={getBranches}
    />
  );

  return (
    <div className="flex h-svh flex-col">
      <ChatHeader chatId={chatId} />
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 md:px-6">
          <div className="w-full max-w-4xl">
            <Greeting codeMode={codeMode} />
            {error && (
              <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error.message || 'Something went wrong. Please try again.'}
              </div>
            )}
            <div className="mt-4">
              <ChatInput
                input={input}
                setInput={setInput}
                onSubmit={handleSend}
                status={status}
                stop={stop}
                files={files}
                setFiles={setFiles}
                canSendOverride={codeModeCanSend ? undefined : false}
              />
            </div>
            <div className="mt-3">
              {codeModeToggle}
            </div>
          </div>
        </div>
      ) : (
        <>
          <Messages messages={messages} status={status} onRetry={handleRetry} onEdit={handleEdit} />
          {error && (
            <div className="mx-auto w-full max-w-4xl px-2 md:px-4">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {error.message || 'Something went wrong. Please try again.'}
              </div>
            </div>
          )}
          <ChatInput
            input={input}
            setInput={setInput}
            onSubmit={handleSend}
            status={status}
            stop={stop}
            files={files}
            setFiles={setFiles}
            disabled={isWorkspaceLaunched}
            placeholder={isWorkspaceLaunched ? 'Workspace launched — click the link above to start coding.' : 'Send a message...'}
          />
          {codeMode && (
            <div className="mx-auto w-full max-w-4xl px-4 pb-1 md:px-6">
              {codeModeToggle}
            </div>
          )}
        </>
      )}
    </div>
  );
}
