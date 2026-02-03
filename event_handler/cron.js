const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { createJob } = require('./tools/create-job');

/**
 * Load and schedule crons from CRONS.json
 * @returns {Array} - Array of scheduled cron tasks
 */
function loadCrons() {
  const cronFile = path.join(__dirname, '..', 'operating_system', 'CRONS.json');
  if (!fs.existsSync(cronFile)) {
    console.log('No CRONS.json found, skipping cron setup');
    return [];
  }

  const crons = JSON.parse(fs.readFileSync(cronFile, 'utf8'));
  const tasks = [];

  for (const { name, schedule, job, enabled } of crons) {
    if (enabled === false) continue;

    if (!cron.validate(schedule)) {
      console.error(`Invalid cron schedule for "${name}": ${schedule}`);
      continue;
    }

    const task = cron.schedule(schedule, async () => {
      console.log(`Running cron: ${name}`);
      try {
        const result = await createJob(job);
        console.log(`Cron ${name} created job: ${result.job_id}`);
      } catch (err) {
        console.error(`Cron ${name} failed:`, err.message);
      }
    });

    tasks.push({ name, schedule, task });
    console.log(`Scheduled cron: ${name} (${schedule})`);
  }

  return tasks;
}

// Run if executed directly
if (require.main === module) {
  console.log('Starting cron scheduler...');
  loadCrons();
}

module.exports = { loadCrons };
