// Synthetic-data runtime verification only. No real accounts are used.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const stateFile = process.env.SMOKE_STATE || '/app/data/.smoke-state.json';
const phase = process.argv[2];
let cookie = '';
async function api(path, data, status = 200) {
  const response = await fetch(base + path, { method: data === undefined ? 'GET' : 'POST', headers: { Cookie: cookie, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  const header = response.headers.get('set-cookie');
  if (header) cookie = header.split(';')[0];
  return result;
}
assert.equal((await api('/health')).status, 'ok');
if (phase === 'seed') {
  const id = randomBytes(8).toString('hex');
  await api('/api/register', { name: 'Course tester', home: 'Synthetic course home', email: `course-${id}@example.com`, password: randomBytes(20).toString('hex') }, 201);
  const pet = await api('/api/pets', { name: 'Course Mochi', species: 'cat' }, 201);
  const task = await api('/api/tasks', { pet_id: pet.id, title: 'Synthetic care task', due: new Date().toISOString() }, 201);
  await api(`/api/tasks/${task.id}/claim`, {});
  await api(`/api/tasks/${task.id}/complete`, { note: 'Course container synthetic smoke' });
  await api(`/api/tasks/${task.id}/complete`, {}, 409);
  writeFileSync(stateFile, JSON.stringify({ cookie, task: task.id }), { mode: 0o600 });
  console.log('PASS deployed HTTP flow: register -> pet -> task -> claim -> complete -> duplicate rejected');
} else if (phase === 'verify') {
  const state = JSON.parse(readFileSync(stateFile, 'utf8')); cookie = state.cookie;
  const dashboard = await api('/api/dashboard');
  const task = dashboard.tasks.find(t => t.id === state.task);
  assert.equal(task.status, 'done'); assert.equal(task.note, 'Course container synthetic smoke');
  assert.equal(dashboard.events.filter(e => e.task_id === task.id && e.action === 'complete').length, 1);
  await api('/api/logout', {}); await api('/api/dashboard', undefined, 401);
  unlinkSync(stateFile);
  console.log('PASS after container recreation: session, task, note and single completion audit persisted; logout revoked session');
} else throw new Error('Usage: node scripts/smoke.mjs seed|verify');
