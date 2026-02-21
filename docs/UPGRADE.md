# Upgrading

For the standard upgrade process (manual or automated), see [Manual Updating](../README.md#manual-updating) in the README. This document covers **how automated upgrades work** and **how to recover when something goes wrong**.

## How Automated Upgrades Work

Two GitHub Actions workflows handle automated upgrades:

### 1. upgrade-event-handler.yml (manual trigger)

Triggered via `workflow_dispatch` (Actions tab > "Upgrade Event Handler" > Run workflow). This workflow:

1. Clones your repo into a temp directory inside the event handler container
2. Runs `npm install` + `npm update thepopebot`
3. If the version changed, creates an `upgrade/thepopebot-<version>-<timestamp>` branch
4. Opens a PR and enables auto-merge with `--delete-branch`

This workflow only updates `package.json` and `package-lock.json`. It does **not** run `thepopebot init`, rebuild, or restart anything. That happens when the PR merges.

### 2. rebuild-event-handler.yml (on push to main)

Triggered automatically when the upgrade PR merges to `main`. This workflow detects the version change and:

1. Runs `npx thepopebot init` inside the container to scaffold updated templates
2. Commits any template changes back to `main`
3. Updates `THEPOPEBOT_VERSION` in the server's `.env`
4. Pulls the new Docker image for the event handler
5. Stops the old container and starts a new one
6. Runs `npm install --omit=dev` in the new container
7. Builds `.next` and restarts PM2

If the version didn't change (normal code push), it skips steps 1-5 and does a fast rebuild only (npm install + build + PM2 reload).

## Recovering from a Failed Upgrade

### Diagnosing the Problem

Run these commands on your server to understand the current state:

```bash
# Check if the container is running
docker ps -a | grep thepopebot-event-handler

# Check PM2 status inside the container
docker exec thepopebot-event-handler npx pm2 status

# Check what version is installed vs what .env expects
docker exec thepopebot-event-handler node -p "require('./node_modules/thepopebot/package.json').version"
grep THEPOPEBOT_VERSION .env

# Check container logs
docker logs thepopebot-event-handler --tail 50

# Check PM2 logs
docker exec thepopebot-event-handler npx pm2 logs --lines 30
```

### Scenario: Upgrade PR Has Merge Conflicts

**Symptom:** The upgrade PR stays open in GitHub with merge conflict warnings.

**Fix:** Resolve the conflicts manually in the GitHub UI or locally:

```bash
git fetch origin
git checkout upgrade/thepopebot-<version>-<timestamp>
git merge main
# resolve conflicts
git push
```

Once the conflicts are resolved, the PR will merge and `rebuild-event-handler.yml` takes over.

### Scenario: Container Won't Start

**Symptom:** `docker ps` shows the container restarting, or it's missing entirely.

**Fix:** Roll back to the previous Docker image by reverting `THEPOPEBOT_VERSION` in `.env`:

```bash
# Find the previous version
git log --oneline -5 -- .env

# Edit .env and set THEPOPEBOT_VERSION to the previous working version
# Then pull that image and restart
docker compose pull event-handler
docker compose up -d event-handler
```

### Scenario: Build Fails Inside Container

**Symptom:** PM2 crash-loops with "Could not find a production build" or the build step in the workflow fails.

**Fix:** Run the build manually inside the container:

```bash
# Install dependencies
docker exec thepopebot-event-handler npm install --omit=dev

# Build
docker exec thepopebot-event-handler bash -c 'rm -rf .next-new .next-old && NEXT_BUILD_DIR=.next-new npm run build && mv .next .next-old 2>/dev/null; mv .next-new .next && rm -rf .next-old'

# Restart PM2
docker exec thepopebot-event-handler npx pm2 restart all
```

If the build fails with errors, check that the installed thepopebot version matches what your code expects. You may need to run `npm install` on the host first to update `package-lock.json`, then rebuild:

```bash
npm install --omit=dev
npm run build
docker exec thepopebot-event-handler npm install --omit=dev
docker exec thepopebot-event-handler bash -c 'rm -rf .next-new .next-old && NEXT_BUILD_DIR=.next-new npm run build && mv .next .next-old 2>/dev/null; mv .next-new .next && rm -rf .next-old'
docker exec thepopebot-event-handler npx pm2 restart all
```

### Scenario: node_modules Corrupted

**Symptom:** Errors about native modules (e.g., `better-sqlite3`), architecture mismatches (`invalid ELF header`), or missing packages.

**Fix:** Recreate the anonymous volume that holds the container's `node_modules`:

```bash
docker compose down
docker compose up -d

# Wait for the container to start, then rebuild
docker exec thepopebot-event-handler npm install --omit=dev
docker exec thepopebot-event-handler bash -c 'rm -rf .next-new .next-old && NEXT_BUILD_DIR=.next-new npm run build && mv .next .next-old 2>/dev/null; mv .next-new .next && rm -rf .next-old'
docker exec thepopebot-event-handler npx pm2 restart all
```

`docker compose down` removes the anonymous volume. When the container starts again, Docker creates a fresh volume from the image's `node_modules`, then `npm install` ensures everything matches your `package-lock.json`.

### Scenario: Disk Space Exhausted

**Symptom:** Build or pull fails with "no space left on device".

**Fix:** Clean up Docker resources and stale build artifacts:

```bash
# Remove unused Docker images, containers, and build cache
docker system prune -f

# Remove old build artifacts if they exist
docker exec thepopebot-event-handler rm -rf .next-old

# Retry the build
docker exec thepopebot-event-handler bash -c 'rm -rf .next-new .next-old && NEXT_BUILD_DIR=.next-new npm run build && mv .next .next-old 2>/dev/null; mv .next-new .next && rm -rf .next-old'
docker exec thepopebot-event-handler npx pm2 restart all
```

### Scenario: Full Reset

**Symptom:** Nothing else worked, or multiple things are broken at once.

**Fix:** Tear everything down and start fresh:

```bash
# Stop and remove all containers and volumes
docker compose down

# Pull latest code
git pull origin main

# Re-scaffold templates (updates workflows, docker-compose, etc.)
npx thepopebot init

# Build on the host
npm run build

# Make sure THEPOPEBOT_VERSION in .env matches the installed version
INSTALLED=$(node -p "require('./node_modules/thepopebot/package.json').version")
sed -i.bak "s/^THEPOPEBOT_VERSION=.*/THEPOPEBOT_VERSION=$INSTALLED/" .env && rm -f .env.bak
echo "Set THEPOPEBOT_VERSION=$INSTALLED"

# Start everything
docker compose up -d

# Install and build inside the container
docker exec thepopebot-event-handler npm install --omit=dev
docker exec thepopebot-event-handler bash -c 'rm -rf .next-new .next-old && NEXT_BUILD_DIR=.next-new npm run build && mv .next .next-old 2>/dev/null; mv .next-new .next && rm -rf .next-old'
docker exec thepopebot-event-handler npx pm2 restart all
```

## A Note on Version Rollback

Rolling back `THEPOPEBOT_VERSION` in `.env` only changes which Docker image is used for the event handler container. If the upgrade PR already merged code changes to `main` (updated `package.json`, `package-lock.json`, or scaffolded templates), a full rollback requires reverting that commit too:

```bash
# Find the upgrade commit
git log --oneline -10

# Revert it
git revert <commit-hash>
git push origin main
```

This triggers `rebuild-event-handler.yml` again, which will do a fast rebuild with the reverted code.
