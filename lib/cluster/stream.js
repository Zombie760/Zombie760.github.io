import { auth } from '../auth/index.js';
import { getClusterById, getClusterWorkersByCluster, workerShortId } from '../db/clusters.js';
import { clusterNaming } from './execute.js';
import { inspectContainer, tailContainerLogs, getContainerStats } from '../tools/docker.js';
import { mapLine } from '../ai/headless-stream.js';

function workerContainerName(project, worker) {
  return `${project}-worker-${workerShortId(worker)}`;
}

export async function GET(request) {
  const session = await auth();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const clusterIdx = parts.indexOf('cluster');
  const clusterId = clusterIdx >= 0 ? parts[clusterIdx + 1] : null;

  if (!clusterId) {
    return new Response('Missing clusterId', { status: 400 });
  }

  const cluster = getClusterById(clusterId);
  if (!cluster || cluster.userId !== session.user.id) {
    return new Response('Not found', { status: 404 });
  }

  const { project } = clusterNaming(cluster);
  const controller = new AbortController();
  const { signal } = controller;

  const stream = new ReadableStream({
    async start(streamController) {
      const encoder = new TextEncoder();
      const activeTails = new Map(); // workerId -> { stream, cleanup }

      function send(event, data) {
        try {
          streamController.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      }

      // Tail logs for a single worker
      function startTailing(worker) {
        const wId = worker.id;
        if (activeTails.has(wId)) return;

        const containerName = workerContainerName(project, worker);
        const entry = { stream: null, alive: true };
        activeTails.set(wId, entry);

        (async () => {
          try {
            const logStream = await tailContainerLogs(containerName);
            if (!entry.alive || signal.aborted) {
              logStream.destroy();
              return;
            }
            entry.stream = logStream;

            let frameBuf = Buffer.alloc(0);
            let stdoutBuf = '';
            let stderrBuf = '';

            logStream.on('data', (chunk) => {
              frameBuf = Buffer.concat([frameBuf, chunk]);
              let stdoutChunk = '';
              let stderrChunk = '';
              while (frameBuf.length >= 8) {
                const size = frameBuf.readUInt32BE(4);
                if (frameBuf.length < 8 + size) break;
                const streamType = frameBuf[0];
                if (streamType === 1) stdoutChunk += frameBuf.slice(8, 8 + size).toString('utf8');
                else if (streamType === 2) stderrChunk += frameBuf.slice(8, 8 + size).toString('utf8');
                frameBuf = frameBuf.slice(8 + size);
              }

              if (stdoutChunk) {
                stdoutBuf += stdoutChunk;
                const lines = stdoutBuf.split('\n');
                stdoutBuf = lines.pop();
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed) continue;
                  send('log', { workerId: wId, stream: 'stdout', raw: trimmed, parsed: mapLine(trimmed) });
                }
              }

              if (stderrChunk) {
                stderrBuf += stderrChunk;
                const lines = stderrBuf.split('\n');
                stderrBuf = lines.pop();
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed) continue;
                  send('log', { workerId: wId, stream: 'stderr', raw: trimmed });
                }
              }
            });

            logStream.on('end', () => {
              stopTailing(wId);
            });

            logStream.on('error', () => {
              stopTailing(wId);
            });
          } catch {
            stopTailing(wId);
          }
        })();
      }

      function stopTailing(wId) {
        const entry = activeTails.get(wId);
        if (!entry) return;
        entry.alive = false;
        if (entry.stream) {
          try { entry.stream.destroy(); } catch {}
        }
        activeTails.delete(wId);
      }

      // Status + stats polling
      async function pollStatus() {
        if (signal.aborted) return;
        try {
          const workers = getClusterWorkersByCluster(clusterId);
          const statuses = {};

          for (const worker of workers) {
            const containerName = workerContainerName(project, worker);
            const wId = worker.id;
            try {
              const info = await inspectContainer(containerName);
              const running = info?.State?.Running === true;

              if (running) {
                const stats = await getContainerStats(containerName);
                statuses[wId] = {
                  running: true,
                  cpu: stats?.cpu ?? 0,
                  memUsage: stats?.memUsage ?? 0,
                  memLimit: stats?.memLimit ?? 0,
                  netRx: stats?.netRx ?? 0,
                  netTx: stats?.netTx ?? 0,
                };
                // Start tailing if not already
                startTailing(worker);
              } else {
                statuses[wId] = { running: false };
                stopTailing(wId);
              }
            } catch {
              statuses[wId] = { running: false };
              stopTailing(wId);
            }
          }

          send('status', { workers: statuses });
        } catch {}
      }

      // Initial poll
      await pollStatus();

      // Poll every 3s
      const statusInterval = setInterval(pollStatus, 3000);

      // Keepalive every 15s
      const keepaliveInterval = setInterval(() => {
        send('ping', {});
      }, 15000);

      // Cleanup on abort
      signal.addEventListener('abort', () => {
        clearInterval(statusInterval);
        clearInterval(keepaliveInterval);
        for (const wId of activeTails.keys()) {
          stopTailing(wId);
        }
        try { streamController.close(); } catch {}
      });
    },
    cancel() {
      controller.abort();
    },
  });

  // Abort when client disconnects
  request.signal?.addEventListener('abort', () => controller.abort());

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
