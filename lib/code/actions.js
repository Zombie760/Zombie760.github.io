'use server';

import { auth } from '../auth/index.js';
import {
  createClaudeWorkspace as dbCreateClaudeWorkspace,
  getClaudeWorkspaceById,
  getClaudeWorkspacesByUser,
  updateClaudeWorkspaceTitle,
  toggleClaudeWorkspaceStarred,
  deleteClaudeWorkspace as dbDeleteClaudeWorkspace,
} from '../db/claude-workspaces.js';

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
 * Get all claude workspaces for the authenticated user.
 * @returns {Promise<object[]>}
 */
export async function getClaudeWorkspaces() {
  const user = await requireAuth();
  return getClaudeWorkspacesByUser(user.id);
}

/**
 * Create a new claude workspace.
 * @param {string} containerName - Docker container DNS name
 * @param {string} [title='Claude Workspace']
 * @returns {Promise<object>}
 */
export async function createClaudeWorkspace(containerName, title = 'Claude Workspace') {
  const user = await requireAuth();
  return dbCreateClaudeWorkspace(user.id, containerName, title);
}

/**
 * Rename a claude workspace (with ownership check).
 * @param {string} id
 * @param {string} title
 * @returns {Promise<{success: boolean}>}
 */
export async function renameClaudeWorkspace(id, title) {
  const user = await requireAuth();
  const workspace = getClaudeWorkspaceById(id);
  if (!workspace || workspace.userId !== user.id) {
    return { success: false };
  }
  updateClaudeWorkspaceTitle(id, title);
  return { success: true };
}

/**
 * Toggle a claude workspace's starred status (with ownership check).
 * @param {string} id
 * @returns {Promise<{success: boolean, starred?: number}>}
 */
export async function starClaudeWorkspace(id) {
  const user = await requireAuth();
  const workspace = getClaudeWorkspaceById(id);
  if (!workspace || workspace.userId !== user.id) {
    return { success: false };
  }
  const starred = toggleClaudeWorkspaceStarred(id);
  return { success: true, starred };
}

/**
 * Delete a claude workspace (with ownership check).
 * @param {string} id
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteClaudeWorkspace(id) {
  const user = await requireAuth();
  const workspace = getClaudeWorkspaceById(id);
  if (!workspace || workspace.userId !== user.id) {
    return { success: false };
  }
  dbDeleteClaudeWorkspace(id);
  return { success: true };
}
