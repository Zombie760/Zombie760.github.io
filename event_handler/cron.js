const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execAsync = promisify(exec);
const { createJob } = require('./tools/create-job');

/**
 * Load and schedule crons from CRONS.json
 * @returns {Array} - Array of scheduled cron tasks
 */
function loadCrons() {
  const cronFile = path.join(__dirname, '..', 'operating_system', 'CRONS.json');

  console.log('\n--- Cron Jobs ---');

  if (!fs.existsSync(cronFile)) {
    console.log('No CRONS.json found');
    console.log('-----------------\n');
    return [];
  }

  const crons = JSON.parse(fs.readFileSync(cronFile, 'utf8'));
  const tasks = [];

  for (const { name, schedule, job, command, type = 'agent', enabled } of crons) {
    if (enabled === false) continue;

    if (!cron.validate(schedule)) {
      console.error(`Invalid schedule for "${name}": ${schedule}`);
      continue;
    }

    const task = cron.schedule(schedule, async () => {
      console.log(`Running cron: ${name}`);
      try {
        if (type === 'command') {
          const { stdout, stderr } = await execAsync(command);
          if (stdout) console.log(`Cron ${name} output: ${stdout.trim()}`);
          if (stderr) console.error(`Cron ${name} stderr: ${stderr.trim()}`);
          console.log(`Cron ${name} command completed`);
        } else {
          const result = await createJob(job);
          console.log(`Cron ${name} created job: ${result.job_id}`);
        }
      } catch (err) {
        console.error(`Cron ${name} failed:`, err.message);
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

// Run if executed directly
if (require.main === module) {
  console.log('Starting cron scheduler...');
  loadCrons();
}

module.exports = { loadCrons };
