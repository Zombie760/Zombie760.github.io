'use server';

import { auth } from '../auth/index.js';
import {
  createCluster as dbCreateCluster,
  getClusterById,
  getClustersByUser,
  updateClusterName as dbUpdateClusterName,
  updateClusterSystemPrompt as dbUpdateClusterSystemPrompt,
  toggleClusterStarred as dbToggleClusterStarred,
  deleteCluster as dbDeleteCluster,
  createClusterRole as dbCreateClusterRole,
  getClusterRoleById,
  getClusterRolesByUser,
  updateClusterRole as dbUpdateClusterRole,
  deleteClusterRole as dbDeleteClusterRole,
  createClusterWorker as dbCreateClusterWorker,
  getClusterWorkersByCluster,
  updateClusterWorkerRoleId as dbUpdateClusterWorkerRoleId,
  updateClusterWorkerName as dbUpdateClusterWorkerName,
  updateWorkerTriggerConfig as dbUpdateWorkerTriggerConfig,
  deleteClusterWorker as dbDeleteClusterWorker,
} from '../db/clusters.js';

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

// ── Clusters ──────────────────────────────────────────────

export async function getClusters() {
  const user = await requireAuth();
  return getClustersByUser(user.id);
}

export async function getCluster(clusterId) {
  const user = await requireAuth();
  const cluster = getClusterById(clusterId);
  if (!cluster || cluster.userId !== user.id) return null;
  const workers = getClusterWorkersByCluster(clusterId).map((w) => ({
    ...w,
    triggerConfig: w.triggerConfig ? JSON.parse(w.triggerConfig) : null,
  }));
  return { ...cluster, workers };
}

export async function createCluster(name = 'New Cluster') {
  const user = await requireAuth();
  return dbCreateCluster(user.id, { name });
}

export async function renameCluster(clusterId, name) {
  const user = await requireAuth();
  const cluster = getClusterById(clusterId);
  if (!cluster || cluster.userId !== user.id) return { success: false };
  dbUpdateClusterName(clusterId, name);
  return { success: true };
}

export async function starCluster(clusterId) {
  const user = await requireAuth();
  const cluster = getClusterById(clusterId);
  if (!cluster || cluster.userId !== user.id) return { success: false };
  const starred = dbToggleClusterStarred(clusterId);
  return { success: true, starred };
}

export async function updateClusterSystemPrompt(clusterId, systemPrompt) {
  const user = await requireAuth();
  const cluster = getClusterById(clusterId);
  if (!cluster || cluster.userId !== user.id) return { success: false };
  dbUpdateClusterSystemPrompt(clusterId, systemPrompt);
  return { success: true };
}

export async function deleteCluster(clusterId) {
  const user = await requireAuth();
  const cluster = getClusterById(clusterId);
  if (!cluster || cluster.userId !== user.id) return { success: false };
  dbDeleteCluster(clusterId);
  return { success: true };
}

// ── Cluster Roles ─────────────────────────────────────────

export async function getClusterRoles() {
  const user = await requireAuth();
  return getClusterRolesByUser(user.id);
}

export async function createClusterRole(roleName, role = '') {
  const user = await requireAuth();
  return dbCreateClusterRole(user.id, { roleName, role });
}

export async function updateClusterRole(roleId, { roleName, role }) {
  const user = await requireAuth();
  const existing = getClusterRoleById(roleId);
  if (!existing || existing.userId !== user.id) return { success: false };
  dbUpdateClusterRole(roleId, { roleName, role });
  return { success: true };
}

export async function deleteClusterRole(roleId) {
  const user = await requireAuth();
  const existing = getClusterRoleById(roleId);
  if (!existing || existing.userId !== user.id) return { success: false };
  dbDeleteClusterRole(roleId);
  return { success: true };
}

// ── Cluster Workers ───────────────────────────────────────

export async function addClusterWorker(clusterId, clusterRoleId = null) {
  const user = await requireAuth();
  const cluster = getClusterById(clusterId);
  if (!cluster || cluster.userId !== user.id) return { success: false };
  const worker = dbCreateClusterWorker(clusterId, { clusterRoleId });
  return { success: true, worker };
}

export async function assignWorkerRole(workerId, clusterRoleId) {
  await requireAuth();
  dbUpdateClusterWorkerRoleId(workerId, clusterRoleId);
  return { success: true };
}

export async function renameClusterWorker(workerId, name) {
  await requireAuth();
  dbUpdateClusterWorkerName(workerId, name);
  return { success: true };
}

export async function updateWorkerTriggers(workerId, triggerConfig) {
  await requireAuth();
  dbUpdateWorkerTriggerConfig(workerId, triggerConfig);
  // Reload cluster runtime so crons/webhooks reflect the change
  const { reloadClusterRuntime } = await import('./runtime.js');
  reloadClusterRuntime();
  return { success: true };
}

export async function triggerWorkerManually(workerId) {
  await requireAuth();
  const { executeWorker } = await import('./execute.js');
  const result = await executeWorker(workerId, 'manual');
  return result;
}

export async function removeClusterWorker(workerId) {
  await requireAuth();
  dbDeleteClusterWorker(workerId);
  // Reload cluster runtime in case this worker had triggers
  const { reloadClusterRuntime } = await import('./runtime.js');
  reloadClusterRuntime();
  return { success: true };
}
