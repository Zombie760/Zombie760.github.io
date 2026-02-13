/**
 * Next.js instrumentation hook for thepopebot.
 * This file is loaded by Next.js on server start when instrumentationHook is enabled.
 *
 * Users should create an instrumentation.js in their project root that imports this:
 *
 *   export { register } from 'thepopebot/instrumentation';
 *
 * Or they can re-export and add their own logic.
 */

let initialized = false;

export async function register() {
  // Only run on the server, and only once
  if (typeof window !== 'undefined' || initialized) return;
  initialized = true;

  // Load .env from project root
  const dotenv = await import('dotenv');
  dotenv.config();

  // Validate AUTH_SECRET is set (required by Auth.js for session encryption)
  if (!process.env.AUTH_SECRET) {
    console.error('\n  ERROR: AUTH_SECRET is not set in your .env file.');
    console.error('  This is required for session encryption.');
    console.error('  Run "npm run setup" to generate it automatically, or add manually:');
    console.error('  openssl rand -base64 32\n');
    throw new Error('AUTH_SECRET environment variable is required');
  }

  // Initialize auth database
  const { initDatabase } = await import('../lib/db/index.js');
  initDatabase();

  // Start cron scheduler
  const { loadCrons } = await import('../lib/cron.js');
  loadCrons();

  console.log('thepopebot initialized');
}
