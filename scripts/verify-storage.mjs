import { DatabaseSync, backup } from 'node:sqlite';
import assert from 'node:assert/strict';
const source = process.env.DB_PATH || './data/pawroster.db';
const db = new DatabaseSync(source, { readOnly: true });
const counts = Object.fromEntries(['users', 'homes', 'memberships', 'pets', 'tasks', 'events', 'pet_records'].map(table => [table, db.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count]));
assert.ok(counts.tasks > 0, 'Create a synthetic task through the UI before running this check');
const output = process.argv[2];
if (output) {
  await backup(db, output);
  const restored = new DatabaseSync(output, { readOnly: true });
  assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  for (const [table, count] of Object.entries(counts)) assert.equal(restored.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count, count);
  for (const table of ['memberships', 'pets', 'tasks', 'pet_records']) assert.deepEqual(restored.prepare(`SELECT * FROM ${table} ORDER BY ${table === 'memberships' ? 'home_id,user_id' : 'id'}`).all(), db.prepare(`SELECT * FROM ${table} ORDER BY ${table === 'memberships' ? 'home_id,user_id' : 'id'}`).all());
  restored.close();
  console.log('PASS: SQLite online backup, restored integrity and task states match');
}
console.log(JSON.stringify(counts)); db.close();
