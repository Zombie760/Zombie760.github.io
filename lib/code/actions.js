'use server';

import { auth } from '../auth/index.js';
import {
  createCodeWorkspace as dbCreateCodeWorkspace,
  getCodeWorkspaceById,
  getCodeWorkspacesByUser,
  updateCodeWorkspaceTitle,
  updateContainerName,
  toggleCodeWorkspaceStarred,
  deleteCodeWorkspace as dbDeleteCodeWorkspace,
} from '../db/code-workspaces.js';
import {
  getChatById,
  getChatByWorkspaceId,
  getMessagesByChatId,
} from '../db/chats.js';

const RECOVERABLE_STATES = new Set(['exited', 'created', 'paused']);
const CONTEXT_CHAR_BUDGET = 12000;

/**
 * Build a chat context JSON string for passing to the interactive container.
 * Includes the first user message (sets the topic) + recent messages up to a char budget.
 * @param {string} chatId
 * @returns {string|null} JSON string or null if no messages
 */
function buildChatContext(chatId) {
  const chat = getChatById(chatId);
  if (!chat) return null;
  const allMessages = getMessagesByChatId(chatId);
  if (allMessages.length === 0) return null;

  const first = allMessages[0];
  const selected = [{ role: first.role, content: first.content }];
  let charCount = first.content.length;

  // Walk backward from end, adding messages up to budget
  for (let i = allMessages.length - 1; i > 0; i--) {
    const msg = allMessages[i];
    if (charCount + msg.content.length > CONTEXT_CHAR_BUDGET) break;
    selected.push({ role: msg.role, content: msg.content });
    charCount += msg.content.length;
  }

  // Reverse the tail messages (they were added back-to-front), keep first at index 0
  if (selected.length > 1) {
    const [firstMsg, ...rest] = selected;
    selected.length = 0;
    selected.push(firstMsg, ...rest.reverse());
  }

  return JSON.stringify({ title: chat.title || 'Untitled', messages: selected });
}

/**
 * Get the authenticated user or throw.
 */
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

/**
 * Get all code workspaces for the authenticated user.
 * @returns {Promise<object[]>}
 */
export async function getCodeWorkspaces() {
  const user = await requireAuth();
  return getCodeWorkspacesByUser(user.id);
}

/**
 * Create a new code workspace.
 * @param {string} containerName - Docker container DNS name
 * @param {string} [title='Code Workspace']
 * @returns {Promise<object>}
 */
export async function createCodeWorkspace(containerName, title = 'Code Workspace') {
  const user = await requireAuth();
  return dbCreateCodeWorkspace(user.id, { containerName, title });
}

/**
 * Rename a code workspace (with ownership check).
 * @param {string} id
 * @param {string} title
 * @returns {Promise<{success: boolean}>}
 */
export async function renameCodeWorkspace(id, title) {
  const user = await requireAuth();
  const workspace = getCodeWorkspaceById(id);
  if (!workspace || workspace.userId !== user.id) {
    return { success: false };
  }
  updateCodeWorkspaceTitle(id, title);
  return { success: true };
}

/**
 * Toggle a code workspace's starred status (with ownership check).
 * @param {string} id
 * @returns {Promise<{success: boolean, starred?: number}>}
 */
export async function starCodeWorkspace(id) {
  const user = await requireAuth();
  const workspace = getCodeWorkspaceById(id);
  if (!workspace || workspace.userId !== user.id) {
    return { success: false };
  }
  const starred = toggleCodeWorkspaceStarred(id);
  return { success: true, starred };
}

/**
 * Delete a code workspace (with ownership check).
 * @param {string} id
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteCodeWorkspace(id) {
  const user = await requireAuth();
  const workspace = getCodeWorkspaceById(id);
  if (!workspace || workspace.userId !== user.id) {
    return { success: false };
  }
  dbDeleteCodeWorkspace(id);
  return { success: true };
}

/**
 * Ensure a code workspace's Docker container is running.
 * Recovers stopped/removed containers automatically.
 * @param {string} id - Workspace ID
 * @returns {Promise<{status: string, message?: string}>}
 */
export async function ensureCodeWorkspaceContainer(id) {
  const user = await requireAuth();
  const workspace = getCodeWorkspaceById(id);
  if (!workspace || workspace.userId !== user.id) {
    return { status: 'error', message: 'Workspace not found' };
  }

  if (!workspace.containerName) {
    return { status: 'no_container' };
  }

  try {
    const { inspectContainer, startContainer, removeContainer, createCodeWorkspaceContainer } =
      await import('../tools/docker.js');

    // Build fresh chat context for recreation
    const linkedChat = getChatByWorkspaceId(id);
    const chatContext = linkedChat ? buildChatContext(linkedChat.id) : null;

    const info = await inspectContainer(workspace.containerName);

    if (!info) {
      // Container not found — recreate
      await createCodeWorkspaceContainer({
        containerName: workspace.containerName,
        repo: workspace.repo,
        branch: workspace.branch,
        codingAgent: workspace.codingAgent,
        featureBranch: workspace.featureBranch,
        chatContext,
      });
      return { status: 'created' };
    }

    const state = info.State?.Status;

    if (state === 'running') {
      return { status: 'running' };
    }

    if (RECOVERABLE_STATES.has(state)) {
      try {
        await startContainer(workspace.containerName);
        return { status: 'started' };
      } catch {
        // Start failed — fall through to remove + recreate
      }
    }

    // Dead, bad state, or start failed — remove and recreate
    await removeContainer(workspace.containerName);
    await createCodeWorkspaceContainer({
      containerName: workspace.containerName,
      repo: workspace.repo,
      branch: workspace.branch,
      codingAgent: workspace.codingAgent,
      featureBranch: workspace.featureBranch,
      chatContext,
    });
    return { status: 'created' };
  } catch (err) {
    console.error(`[ensureCodeWorkspaceContainer] workspace=${id}`, err);
    return { status: 'error', message: err.message };
  }
}

/**
 * Start interactive mode: create a Docker container for the workspace.
 * @param {string} id - Workspace ID
 * @returns {Promise<{success: boolean, containerName?: string, message?: string}>}
 */
export async function startInteractiveMode(id) {
  const user = await requireAuth();
  const workspace = getCodeWorkspaceById(id);
  if (!workspace || workspace.userId !== user.id) {
    return { success: false, message: 'Workspace not found' };
  }

  if (workspace.containerName) {
    return { success: true, containerName: workspace.containerName, message: 'Already running' };
  }

  try {
    const { randomUUID } = await import('crypto');
    const containerName = `code-workspace-${randomUUID().slice(0, 8)}`;

    // Build chat context for the container
    const linkedChat = getChatByWorkspaceId(id);
    const chatContext = linkedChat ? buildChatContext(linkedChat.id) : null;

    const { createCodeWorkspaceContainer } = await import('../tools/docker.js');
    await createCodeWorkspaceContainer({
      containerName,
      repo: workspace.repo,
      branch: workspace.branch,
      codingAgent: workspace.codingAgent || 'claude-code',
      featureBranch: workspace.featureBranch,
      workspaceId: id,
      chatContext,
    });

    updateContainerName(id, containerName);
    return { success: true, containerName };
  } catch (err) {
    console.error(`[startInteractiveMode] workspace=${id}`, err);
    return { success: false, message: err.message };
  }
}

/**
 * Close interactive mode: stop+remove the container, clear containerName.
 * Volume is preserved so headless mode can reuse it if needed.
 * @param {string} id - Workspace ID
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function closeInteractiveMode(id) {
  const user = await requireAuth();
  const workspace = getCodeWorkspaceById(id);
  if (!workspace || workspace.userId !== user.id) {
    return { success: false, message: 'Workspace not found' };
  }

  if (!workspace.containerName) {
    return { success: true, message: 'No container running' };
  }

  try {
    const { removeContainer, removeCodeWorkspaceVolume } = await import('../tools/docker.js');
    await removeContainer(workspace.containerName);
    await removeCodeWorkspaceVolume(id);
    updateContainerName(id, null);
    const linkedChat = getChatByWorkspaceId(id);
    return { success: true, chatId: linkedChat?.id || null };
  } catch (err) {
    console.error(`[closeInteractiveMode] workspace=${id}`, err);
    return { success: false, message: err.message };
  }
}
