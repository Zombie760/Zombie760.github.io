import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { thepopebotDb, dataDir } from '../paths.js';
import * as schema from './schema.js';

let _db = null;

/**
 * Get or create the Drizzle database instance (lazy singleton).
 * @returns {import('drizzle-orm/better-sqlite3').BetterSQLite3Database}
 */
export function getDb() {
  if (!_db) {
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const sqlite = new Database(thepopebotDb);
    sqlite.pragma('journal_mode = WAL');
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

/**
 * Initialize the database — apply pending migrations.
 * Called from instrumentation.js at server startup.
 * Uses Drizzle Kit migrations from the package's drizzle/ folder.
 */
export function initDatabase() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = new Database(thepopebotDb);
  sqlite.pragma('journal_mode = WAL');
  const db = drizzle(sqlite, { schema });

  // Resolve migrations folder relative to this package (not process.cwd())
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.join(__dirname, '..', '..', 'drizzle');

  migrate(db, { migrationsFolder });

  sqlite.close();

  // Force re-creation of drizzle instance on next getDb() call
  _db = null;
}
