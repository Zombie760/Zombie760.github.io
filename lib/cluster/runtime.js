import cron from 'node-cron';
import { getAllRolesWithTriggers, getRoleWithCluster } from '../db/clusters.js';
import { runClusterRole } from './execute.js';
import path from 'path';

// ── In-memory state ──────────────────────────────────────────────
let _cronTasks = [];      // [{ roleId, task }]
let _fileWatchers = [];   // [{ roleId, watcher }]

// ── Boot & Reload ────────────────────────────────────────────────

/**
 * Start the cluster runtime — schedule crons and file watchers.
 * Called once at boot from instrumentation.js.
 */
export function startClusterRuntime() {
  try {
    loadRoles();
    console.log('[cluster] Runtime started');
  } catch (err) {
    console.error('[cluster] Failed to start runtime:', err.message);
  }
}

/**
 * Stop all crons, close file watchers, and re-load from DB.
 * Called when roles/triggers are updated via UI.
 */
export function reloadClusterRuntime() {
  for (const { task } of _cronTasks) {
    task.stop();
  }
  _cronTasks = [];

  for (const { watcher } of _fileWatchers) {
    watcher.close();
  }
  _fileWatchers = [];

  try {
    loadRoles();
    console.log('[cluster] Runtime reloaded');
  } catch (err) {
    console.error('[cluster] Failed to reload runtime:', err.message);
  }
}

/**
 * Load all roles with trigger configs from DB and set up crons/file watchers.
 * Webhooks are always-on — no registration needed.
 */
function loadRoles() {
  const roles = getAllRolesWithTriggers();
  let cronCount = 0;
  let fileWatchCount = 0;

  for (const role of roles) {
    const config = role.triggerConfig;
    if (!config) continue;

    // Cron trigger — fires via internal webhook fetch
    if (config.cron && config.cron.enabled && config.cron.schedule) {
      const schedule = config.cron.schedule;
      if (!cron.validate(schedule)) {
        console.warn(`[cluster] Invalid cron schedule for role ${role.id}: ${schedule}`);
        continue;
      }
      const task = cron.schedule(schedule, () => {
        fireWebhook(role.id).catch((err) => {
          console.error(`[cluster] Cron execution failed for role ${role.id}:`, err.message);
        });
      });
      _cronTasks.push({ roleId: role.id, task });
      cronCount++;
    }

    // File watch trigger — fires via internal webhook fetch
    if (config.file_watch && config.file_watch.enabled && config.file_watch.paths) {
      setupFileWatch(role);
      fileWatchCount++;
    }
  }

  if (cronCount > 0 || fileWatchCount > 0) {
    console.log(`[cluster] Loaded ${cronCount} cron(s), ${fileWatchCount} file watcher(s)`);
  }
}

/**
 * Fire a role's webhook endpoint internally.
 * All triggers (cron, file watch, manual) route through this.
 */
async function fireWebhook(roleId, payload = {}) {
  const roleData = getRoleWithCluster(roleId);
  if (!roleData?.cluster) return;

  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    // Fallback: call runClusterRole directly if no BASE_URL configured
    await runClusterRole(roleId, { payload });
    return;
  }

  const url = `${baseUrl}/api/cluster/${roleData.cluster.id}/role/${roleId}/webhook`;
  const apiKey = process.env.API_KEY;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['x-api-key'] = apiKey;
    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error(`[cluster] Internal webhook fetch failed for role ${roleId}:`, err.message);
    // Fallback: call directly
    await runClusterRole(roleId, { payload });
  }
}

/**
 * Set up a chokidar file watcher for a role.
 */
async function setupFileWatch(role) {
  let chokidar;
  try {
    chokidar = await import('chokidar');
  } catch {
    console.warn(`[cluster] chokidar not installed, skipping file watch for role ${role.id}`);
    return;
  }

  const roleData = getRoleWithCluster(role.id);
  if (!roleData?.cluster) return;

  const { clusterNaming } = await import('./execute.js');
  const { dataDir } = clusterNaming(roleData.cluster);

  const paths = role.triggerConfig.file_watch.paths
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => path.join(dataDir, p));

  if (paths.length === 0) return;

  let debounceTimer = null;
  const watcher = chokidar.watch(paths, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500 },
    ignored: /\/logs\//,
  });

  watcher.on('add', () => debouncedTrigger());
  watcher.on('change', () => debouncedTrigger());

  function debouncedTrigger() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      fireWebhook(role.id).catch((err) => {
        console.error(`[cluster] File watch execution failed for role ${role.id}:`, err.message);
      });
    }, 1000);
  }

  _fileWatchers.push({ roleId: role.id, watcher });
  console.log(`[cluster] File watcher started for role ${role.id}: ${paths.join(', ')}`);
}

// ── Webhook Handler ──────────────────────────────────────────────

/**
 * Handle an incoming webhook request for a cluster role.
 * @param {string} clusterId - Cluster UUID
 * @param {string} roleId - Role UUID
 * @param {Request} request - Incoming request
 * @returns {Promise<Response>}
 */
export async function handleClusterWebhook(clusterId, roleId, request) {
  const roleData = getRoleWithCluster(roleId);
  if (!roleData || !roleData.cluster || roleData.cluster.id !== clusterId) {
    return Response.json({ error: 'Role not found or does not belong to this cluster' }, { status: 404 });
  }

  if (!roleData.cluster.enabled) {
    return Response.json({ error: 'Cluster is disabled' }, { status: 403 });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    // No body is fine
  }

  const result = await runClusterRole(roleId, { payload });

  if (result.concurrencyExceeded) {
    return Response.json({ error: 'Max concurrency reached', max: roleData.maxConcurrency }, { status: 429 });
  }

  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ ok: true, containerName: result.containerName });
}
