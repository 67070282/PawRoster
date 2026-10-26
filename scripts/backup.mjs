import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const source = process.env.DB_PATH || './data/pawroster.db';
const target = process.argv[2];
if (!target || resolve(source) === resolve(target)) throw new Error('Usage: node scripts/backup.mjs backups/care.db (separate destination required)');
mkdirSync(dirname(resolve(target)), { recursive: true });
const db = new DatabaseSync(source, { readOnly: true });
try { await backup(db, target); console.log('Backup saved to ' + target); } finally { db.close(); }
