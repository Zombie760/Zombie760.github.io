import path from 'path';

/**
 * Central path resolver for thepopebot.
 * All paths resolve from process.cwd() (the user's project root).
 */

const PROJECT_ROOT = process.cwd();

export {
  PROJECT_ROOT,
};

// config/ files
export const configDir = path.join(PROJECT_ROOT, 'config');
export const cronsFile = path.join(PROJECT_ROOT, 'config', 'CRONS.json');
export const triggersFile = path.join(PROJECT_ROOT, 'config', 'TRIGGERS.json');
export const chatbotMd = path.join(PROJECT_ROOT, 'config', 'CHATBOT.md');
export const jobSummaryMd = path.join(PROJECT_ROOT, 'config', 'JOB_SUMMARY.md');
export const soulMd = path.join(PROJECT_ROOT, 'config', 'SOUL.md');

// Working directories for command-type actions
export const cronDir = path.join(PROJECT_ROOT, 'cron');
export const triggersDir = path.join(PROJECT_ROOT, 'triggers');

// Logs
export const logsDir = path.join(PROJECT_ROOT, 'logs');

// Data (SQLite memory, etc.)
export const dataDir = path.join(PROJECT_ROOT, 'data');

// Auth database
export const authDb = path.join(PROJECT_ROOT, 'data', 'auth.sqlite');

// .env
export const envFile = path.join(PROJECT_ROOT, '.env');
