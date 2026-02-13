import cron from 'node-cron';
import fs from 'fs';
import { cronsFile, cronDir } from './paths.js';
import { executeAction } from './actions.js';

/**
 * Load and schedule crons from CRONS.json
 * @returns {Array} - Array of scheduled cron tasks
 */
function loadCrons() {
  const cronFile = cronsFile;

  console.log('\n--- Cron Jobs ---');

  if (!fs.existsSync(cronFile)) {
    console.log('No CRONS.json found');
    console.log('-----------------\n');
    return [];
  }

  const crons = JSON.parse(fs.readFileSync(cronFile, 'utf8'));
  const tasks = [];

  for (const cronEntry of crons) {
    const { name, schedule, type = 'agent', enabled } = cronEntry;
    if (enabled === false) continue;

    if (!cron.validate(schedule)) {
      console.error(`Invalid schedule for "${name}": ${schedule}`);
      continue;
    }

    const task = cron.schedule(schedule, async () => {
      try {
        const result = await executeAction(cronEntry, { cwd: cronDir });
        console.log(`[CRON] ${name}: ${result || 'ran'}`);
        console.log(`[CRON] ${name}: completed!`);
      } catch (err) {
        console.error(`[CRON] ${name}: error - ${err.message}`);
      }
    });

    tasks.push({ name, schedule, type, task });
  }

  if (tasks.length === 0) {
    console.log('No active cron jobs');
  } else {
    for (const { name, schedule, type } of tasks) {
      console.log(`  ${name}: ${schedule} (${type})`);
    }
  }

  console.log('-----------------\n');

  return tasks;
}

export { loadCrons };
