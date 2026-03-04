import cron from 'node-cron';
import { getAllWorkersWithTriggers } from '../db/clusters.js';
import { executeWorker } from './execute.js';

// ── In-memory state ──────────────────────────────────────────────
let _cronTasks = [];               // [{ workerId, task }]
let _webhookWorkerIds = new Set(); // worker IDs with webhook: true

// ── Boot & Reload ────────────────────────────────────────────────

/**
 * Start the cluster runtime — schedule crons and register webhook worker IDs.
 * Called once at boot from instrumentation.js.
 */
export function startClusterRuntime() {
  try {
    loadWorkers();
    console.log('[cluster] Runtime started');
  } catch (err) {
    console.error('[cluster] Failed to start runtime:', err.message);
  }
}

/**
 * Stop all crons, clear webhooks, and re-load from DB.
 * Called when workers/triggers are updated via UI.
 */
export function reloadClusterRuntime() {
  // Stop existing crons
  for (const { task } of _cronTasks) {
    task.stop();
  }
  _cronTasks = [];
  _webhookWorkerIds = new Set();

  try {
    loadWorkers();
    console.log('[cluster] Runtime reloaded');
  } catch (err) {
    console.error('[cluster] Failed to reload runtime:', err.message);
  }
}

/**
 * Load all workers with trigger configs from DB and set up crons/webhooks.
 */
function loadWorkers() {
  const workers = getAllWorkersWithTriggers();
  let cronCount = 0;
  let webhookCount = 0;

  for (const worker of workers) {
    const config = worker.triggerConfig;
    if (!config) continue;

    // Cron trigger
    if (config.cron && config.cron.enabled && config.cron.schedule) {
      const schedule = config.cron.schedule;
      if (!cron.validate(schedule)) {
        console.warn(`[cluster] Invalid cron schedule for worker ${worker.id}: ${schedule}`);
        continue;
      }
      const task = cron.schedule(schedule, () => {
        executeWorker(worker.id, 'cron').catch((err) => {
          console.error(`[cluster] Cron execution failed for worker ${worker.id}:`, err.message);
        });
      });
      _cronTasks.push({ workerId: worker.id, task });
      cronCount++;
    }

    // Webhook trigger
    if (config.webhook && config.webhook.enabled) {
      _webhookWorkerIds.add(worker.id);
      webhookCount++;
    }

    // File watch trigger (future)
    if (config.file_watch && config.file_watch.enabled) {
      console.warn(`[cluster] File watch not yet implemented for worker ${worker.id}`);
    }
  }

  if (cronCount > 0 || webhookCount > 0) {
    console.log(`[cluster] Loaded ${cronCount} cron(s), ${webhookCount} webhook(s)`);
  }
}

// ── Webhook Handler ──────────────────────────────────────────────

/**
 * Handle an incoming webhook request for a cluster worker.
 * @param {string} workerId - Worker UUID
 * @param {Request} request - Incoming request
 * @returns {Promise<Response>}
 */
export async function handleClusterWebhook(workerId, request) {
  if (!_webhookWorkerIds.has(workerId)) {
    return Response.json({ error: 'Worker not found or webhook not enabled' }, { status: 404 });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    // No body is fine
  }

  const result = await executeWorker(workerId, 'webhook', { payload });

  if (result.busy) {
    return Response.json({ busy: true, containerName: result.containerName }, { status: 409 });
  }

  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ ok: true, containerName: result.containerName });
}
