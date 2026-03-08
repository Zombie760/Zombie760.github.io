# lib/cluster/ — Cluster System

Clusters are groups of Docker containers spawned on demand from role definitions. Each cluster has roles that define what containers do, with concurrency limits and multiple trigger types.

## Architecture

- **`actions.js`** — Server Actions (`'use server'`) for all cluster UI operations. Handles auth via `requireAuth()`, delegates to DB functions in `lib/db/clusters.js`, and creates directories on disk at lifecycle events.
- **`execute.js`** — Docker container lifecycle: launch, stop, concurrency checks. Uses `claude-code-cluster-worker` Docker image. Exports path helpers for cluster/role directories.
- **`runtime.js`** — In-memory trigger runtime. Manages cron schedules (node-cron) and file watchers (chokidar). Webhooks are always-on. Started at boot, reloaded when triggers change.
- **`stream.js`** — SSE endpoint for console page. Dynamically discovers running containers via `listContainers()`.
- **`components/`** — React UI (cluster-page, clusters-page, cluster-console-page, clusters-layout).

## Naming & IDs

- **Cluster short ID**: `cluster.id` dashes stripped, first 8 chars → used in `cluster-{shortId}` project name
- **Role short ID**: `role.id` dashes stripped, first 8 chars → `roleShortId(role)` from `lib/db/clusters.js`
- **Container name**: `cluster-{clusterShortId}-role-{roleShortId}-{8-char-uuid}` (dynamic per run)

## Directory Structure on Disk

```
data/clusters/
  cluster-{shortId}/              ← created by createCluster()
    shared/                       ← created by createCluster()
      {folder}/                   ← created by updateClusterFolders()
    role-{roleShortId}/           ← created by createClusterRoleAction()
      shared/                     ← created by createClusterRoleAction()
      worker-{uuid}/             ← created per container launch (ephemeral)
```

## Trigger Types

Roles support multiple concurrent triggers. Webhook is always-on. All triggers route through the webhook endpoint internally.

| Trigger | Config Key | How It Works |
|---------|-----------|--------------|
| Manual | (always available) | `triggerRoleManually()` → `runClusterRole()` |
| Webhook | (always-on) | POST to `/api/cluster/{clusterId}/role/{roleId}/webhook` |
| Cron | `cron.schedule` | node-cron → internal webhook fetch |
| File Watch | `file_watch.paths` | chokidar → internal webhook fetch |

## Concurrency

Each role has `maxConcurrency` (default 1). Before launching a container, `listContainers()` counts running instances matching the role's container name prefix. If at max, the webhook returns 429.

## Key Functions

**`execute.js`**:
- `clusterNaming(cluster)` → `{ project, dataDir }` for Docker resource naming
- `clusterDir(cluster)` → absolute path to cluster data directory
- `roleDir(cluster, role)` → absolute path to role subdirectory
- `runClusterRole(roleId, context?)` → launches container with concurrency check
- `stopRoleContainers(cluster, role)` → stops all containers for a role
- `countRunningForRole(cluster, role)` → counts running containers

**`runtime.js`**:
- `startClusterRuntime()` → called once at boot
- `reloadClusterRuntime()` → called after trigger/role changes
- `handleClusterWebhook(clusterId, roleId, request)` → webhook endpoint handler

## DB Tables

- `clusters` — cluster metadata (name, system_prompt, folders, enabled)
- `cluster_roles` — role definitions scoped to a cluster (role_name, role, trigger_config, max_concurrency, cleanup_worker_dir, folders)

Workers are ephemeral containers, not database entities.
