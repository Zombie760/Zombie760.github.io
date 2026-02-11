const path = require('path');

/**
 * Central path resolver for thepopebot.
 * All paths resolve from process.cwd() (the user's project root).
 */

const PROJECT_ROOT = process.cwd();

module.exports = {
  PROJECT_ROOT,

  // config/ files
  configDir: path.join(PROJECT_ROOT, 'config'),
  cronsFile: path.join(PROJECT_ROOT, 'config', 'CRONS.json'),
  triggersFile: path.join(PROJECT_ROOT, 'config', 'TRIGGERS.json'),
  chatbotMd: path.join(PROJECT_ROOT, 'config', 'CHATBOT.md'),
  jobSummaryMd: path.join(PROJECT_ROOT, 'config', 'JOB_SUMMARY.md'),
  soulMd: path.join(PROJECT_ROOT, 'config', 'SOUL.md'),

  // Working directories for command-type actions
  cronDir: path.join(PROJECT_ROOT, 'cron'),
  triggersDir: path.join(PROJECT_ROOT, 'triggers'),

  // Logs
  logsDir: path.join(PROJECT_ROOT, 'logs'),

  // .env
  envFile: path.join(PROJECT_ROOT, '.env'),
};
