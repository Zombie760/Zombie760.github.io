# thepopebot Heartbeat Protocol

## Purpose

The heartbeat system ensures thepopebot remains responsive and can handle periodic tasks even during long-running operations.

## Heartbeat Checks

Every few minutes, you should:

1. **Check for new instructions**
   - Look for updates to your task file
   - Check for priority interrupts in `/workspace/.thepopebot/interrupts/`

2. **Update status**
   - Write current status to `/workspace/.thepopebot/status.json`
   - Include: current task, progress percentage, any blockers

3. **Health check**
   - Verify git remote is accessible
   - Verify browser connection is alive (if using browser)

## Status File Format

```json
{
  "agent_id": "worker-1",
  "branch": "feature/example",
  "task": "Implementing feature X",
  "status": "in_progress",
  "progress": 45,
  "last_heartbeat": "2024-01-15T10:30:00Z",
  "blockers": [],
  "current_action": "Running tests"
}
```

## Interrupt Handling

If you find a file in the interrupts directory:

1. Read the interrupt instruction
2. Pause current work at a safe point
3. Handle the interrupt
4. Delete the interrupt file
5. Resume previous work

## Cron-Style Tasks

Some tasks may be scheduled to run periodically:

- **Cleanup**: Remove temporary files, prune old branches
- **Sync**: Pull latest changes from upstream
- **Report**: Generate status reports

Check `/workspace/.thepopebot/cron/` for scheduled task definitions.

## Failure Recovery

If you crash or restart:

1. Read the last status file
2. Determine what was in progress
3. Resume or restart the task as appropriate
4. Log the recovery in status
