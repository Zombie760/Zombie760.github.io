import { randomUUID } from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { getDb } from './index.js';
import { claudeWorkspaces } from './schema.js';

/**
 * Create a new claude workspace.
 * @param {string} userId
 * @param {string} containerName - Docker container DNS name
 * @param {string} [title='Claude Workspace']
 * @param {string} [id] - Optional ID (UUID). Generated if not provided.
 * @returns {object} The created workspace
 */
export function createClaudeWorkspace(userId, containerName, title = 'Claude Workspace', id = null) {
  const db = getDb();
  const now = Date.now();
  const workspace = {
    id: id || randomUUID(),
    userId,
    containerName,
    title,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(claudeWorkspaces).values(workspace).run();
  return workspace;
}

/**
 * Get a single claude workspace by ID.
 * @param {string} id
 * @returns {object|undefined}
 */
export function getClaudeWorkspaceById(id) {
  const db = getDb();
  return db.select().from(claudeWorkspaces).where(eq(claudeWorkspaces.id, id)).get();
}

/**
 * Get all claude workspaces for a user, ordered by most recently updated.
 * @param {string} userId
 * @returns {object[]}
 */
export function getClaudeWorkspacesByUser(userId) {
  const db = getDb();
  return db
    .select()
    .from(claudeWorkspaces)
    .where(eq(claudeWorkspaces.userId, userId))
    .orderBy(desc(claudeWorkspaces.updatedAt))
    .all();
}

/**
 * Update a claude workspace's title.
 * @param {string} id
 * @param {string} title
 */
export function updateClaudeWorkspaceTitle(id, title) {
  const db = getDb();
  db.update(claudeWorkspaces)
    .set({ title, updatedAt: Date.now() })
    .where(eq(claudeWorkspaces.id, id))
    .run();
}

/**
 * Toggle a claude workspace's starred status.
 * @param {string} id
 * @returns {number} The new starred value (0 or 1)
 */
export function toggleClaudeWorkspaceStarred(id) {
  const db = getDb();
  const workspace = db.select({ starred: claudeWorkspaces.starred }).from(claudeWorkspaces).where(eq(claudeWorkspaces.id, id)).get();
  const newValue = workspace?.starred ? 0 : 1;
  db.update(claudeWorkspaces)
    .set({ starred: newValue })
    .where(eq(claudeWorkspaces.id, id))
    .run();
  return newValue;
}

/**
 * Delete a claude workspace.
 * @param {string} id
 */
export function deleteClaudeWorkspace(id) {
  const db = getDb();
  db.delete(claudeWorkspaces).where(eq(claudeWorkspaces.id, id)).run();
}
