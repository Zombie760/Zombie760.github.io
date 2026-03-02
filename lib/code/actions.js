'use server';

import { auth } from '../auth/index.js';
import {
  createCodeWorkspace as dbCreateCodeWorkspace,
  getCodeWorkspaceById,
  getCodeWorkspacesByUser,
  updateCodeWorkspaceTitle,
  toggleCodeWorkspaceStarred,
  deleteCodeWorkspace as dbDeleteCodeWorkspace,
} from '../db/code-workspaces.js';

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
