import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createApp } from '../src/server.js';

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pawroster-v2-'));
  const app = createApp({ dbPath: join(dir, 'test.db') });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { await new Promise(r => app.server.close(r)); app.db.close(); rmSync(dir, { recursive: true, force: true }); });
  function client(initialCookie = '') {
    let cookie = initialCookie;
    const request = async (path, data, status = 200, headers = {}) => {
      const res = await fetch(url + '/api/' + path, { method: data === undefined ? 'GET' : 'POST', headers: { Cookie: cookie, ...headers, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
      if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
      const result = await res.json(); assert.equal(res.status, status, JSON.stringify(result)); return result;
    };
    request.cookie = () => cookie; return request;
  }
  const a = client(), b = client(), c = client();
  await a('register', { name: 'Alice', home: 'Home A', email: 'a@example.com', password: 'test-password-123' }, 201);
  const first = await a('dashboard');
  await b('register', { name: 'Bob', home: 'Home B', email: 'b@example.com', password: 'test-password-123' }, 201);
  await c('register', { name: 'Charlie', invite: first.user.invite, email: 'c@example.com', password: 'test-password-123' }, 201);
  return { a, b, c, first, app, client };
}

test('M1 existing accounts join multiple homes, switching keeps data isolated per session', async t => {
  const { a, b, first, client } = await fixture(t);
  const homeB = await b('dashboard');
  const petA = await a('pets', { name: 'Cat A', species: 'cat' }, 201);
  await a('homes/join', { invite: homeB.user.invite }, 201);
  let state = await a('dashboard'); assert.equal(state.homes.length, 2); assert.equal(state.user.home_id, homeB.user.home_id); assert.equal(state.user.role, 'member'); assert.equal(state.user.invite, undefined); assert.equal(state.pets.length, 0);
  await a('tasks', { pet_id: petA.id, title: 'Wrong home', due: new Date().toISOString() }, 404);
  await a('homes/switch', { home_id: first.user.home_id });
  assert.equal((await a('dashboard')).pets[0].id, petA.id);
  const secondSession = client(); await secondSession('login', { email: 'a@example.com', password: 'test-password-123' });
  await secondSession('homes/switch', { home_id: homeB.user.home_id });
  assert.equal((await a('dashboard')).user.home_id, first.user.home_id);
  await a('homes/switch', { home_id: 999 }, 403);
  await a('homes/join', { invite: first.user.invite }, 409);
  await a('homes/join', { invite: 'invalid-code' }, 400);
});

test('M2 owners manage invite rotation and names; members cannot expose or rotate codes', async t => {
  const { a, b, c, first } = await fixture(t);
  await c('homes/invite/rotate', {}, 403); await c('homes/rename', { name: 'No' }, 403);
  await a('homes/rename', { name: 'Renamed A' }); assert.equal((await c('dashboard')).user.home_name, 'Renamed A');
  await a('homes/invite/rotate', {});
  const newInvite = (await a('dashboard')).user.invite; assert.notEqual(newInvite, first.user.invite);
  await b('homes/join', { invite: first.user.invite }, 400); await b('homes/join', { invite: newInvite }, 201);
});

test('M3 removal revokes access and releases claimed work with history retained', async t => {
  const { a, c, first } = await fixture(t);
  const pet = await a('pets', { name: 'Cat', species: 'cat' }, 201);
  const task = await c('tasks', { pet_id: pet.id, title: 'Care', due: new Date().toISOString() }, 201);
  await c(`tasks/${task.id}/claim`, {}); const memberId = (await c('dashboard')).user.id;
  await c('homes/members/remove', { user_id: first.user.id }, 403);
  await a('homes/members/remove', { user_id: memberId });
  const state = await c('dashboard'); assert.equal(state.user.home_id, null); assert.equal(state.tasks.length, 0); assert.equal(state.homes.length, 0);
  await c(`tasks/${task.id}/complete`, {}, 409); await c('homes/switch', { home_id: first.user.home_id }, 403);
  const saved = await a('dashboard'); assert.equal(saved.tasks[0].status, 'open'); assert.equal(saved.tasks[0].assignee, null); assert.ok(saved.events.some(e => e.action === 'member_release'));
  await c('homes', { name: 'Fresh start' }, 201); assert.equal((await c('dashboard')).user.role, 'owner');
});

test('M4 ownership transfer and leaving preserve remaining memberships', async t => {
  const { a, b, c, first } = await fixture(t);
  await a('homes/leave', {}, 409);
  await a('homes/transfer', { user_id: 999 }, 400);
  await a('homes/transfer', { user_id: (await c('dashboard')).user.id });
  assert.equal((await a('dashboard')).user.role, 'member'); assert.equal((await c('dashboard')).user.role, 'owner');
  await a('homes/invite/rotate', {}, 403);
  await a('homes/join', { invite: (await b('dashboard')).user.invite }, 201);
  await a('homes/switch', { home_id: first.user.home_id }); await a('homes/leave', {});
  assert.equal((await a('dashboard')).homes.length, 1);
  await a('homes/switch', { home_id: first.user.home_id }, 403);
});

test('M5 stale browser tabs cannot write into a different active household', async t => {
  const { a, first } = await fixture(t);
  const newHome = await a('homes', { name: 'Second' }, 201);
  await a('pets', { name: 'Wrong home', species: 'cat' }, 409, { 'X-Home-ID': String(first.user.home_id) });
  assert.equal((await a('dashboard')).pets.length, 0);
  await a('pets', { name: 'Right home', species: 'cat' }, 201, { 'X-Home-ID': String(newHome.id) });
});

test('M6 task edit permissions, cancellation, priorities and recurrence validation', async t => {
  const { a, c } = await fixture(t);
  const pet = await a('pets', { name: 'Cat', species: 'cat' }, 201), due = new Date().toISOString();
  const task = await a('tasks', { pet_id: pet.id, title: 'Care', due, priority: 'high', recurrence: 'weekly' }, 201);
  await c(`tasks/${task.id}/edit`, { title: 'No', due }, 403); await c(`tasks/${task.id}/cancel`, {}, 403);
  await a(`tasks/${task.id}/edit`, { title: 'Updated', due, priority: 'high', recurrence: 'daily' });
  await a(`tasks/${task.id}/claim`, {}); await a(`tasks/${task.id}/edit`, { title: 'No', due }, 409);
  await a(`tasks/${task.id}/cancel`, {}); await a(`tasks/${task.id}/complete`, {}, 409); await a(`tasks/${task.id}/claim`, {}, 409);
  const saved = await a('dashboard'); assert.equal(saved.tasks.length, 1); assert.ok(saved.tasks[0].cancelled_at); assert.equal(saved.tasks[0].title, 'Updated');
  await a('tasks', { pet_id: pet.id, title: 'Care', due, priority: 'urgent' }, 400);
  await a('tasks', { pet_id: pet.id, title: 'Care', due, recurrence: 'hourly' }, 400);
});

test('M7 completion creates exactly one recurring successor at the original interval', async t => {
  const { a } = await fixture(t);
  const pet = await a('pets', { name: 'Cat', species: 'cat' }, 201), due = '2026-11-12T10:00:00.000Z';
  const task = await a('tasks', { pet_id: pet.id, title: 'Feed', due, priority: 'high', recurrence: 'daily' }, 201);
  await a(`tasks/${task.id}/claim`, {}); await a(`tasks/${task.id}/complete`, { note: 'Done' }); await a(`tasks/${task.id}/complete`, {}, 409);
  let saved = await a('dashboard'); assert.equal(saved.tasks.length, 2);
  let next = saved.tasks.find(t => t.id !== task.id); assert.equal(next.due, '2026-11-13T10:00:00.000Z'); assert.equal(next.priority, 'high'); assert.equal(next.status, 'open'); assert.equal(next.assignee, null);
  await a(`tasks/${next.id}/edit`, { title: 'Weekly', due: next.due, recurrence: 'weekly' });
  await a(`tasks/${next.id}/claim`, {}); await a(`tasks/${next.id}/complete`, {});
  saved = await a('dashboard'); assert.ok(saved.tasks.some(t => t.due === '2026-11-20T10:00:00.000Z'));
});

test('M8 pet notes, archival and restore retain history and enforce house boundaries', async t => {
  const { a, b, c } = await fixture(t);
  const pet = await a('pets', { name: 'Cat', species: 'cat', notes: 'Care note' }, 201);
  await b(`pets/${pet.id}/edit`, { name: 'No', species: 'cat' }, 404);
  await a(`pets/${pet.id}/edit`, { name: 'Mochi', species: 'แมว', notes: '<script>literal</script>' });
  assert.equal((await c('dashboard')).pets[0].notes, '<script>literal</script>');
  await c(`pets/${pet.id}/archive`, { archived: true }, 403);
  const task = await a('tasks', { pet_id: pet.id, title: 'Care', due: new Date().toISOString() }, 201);
  await a(`pets/${pet.id}/archive`, { archived: true }, 409);
  await a(`tasks/${task.id}/cancel`, {}); await a(`pets/${pet.id}/archive`, { archived: true });
  await a('tasks', { pet_id: pet.id, title: 'Care', due: new Date().toISOString() }, 404);
  assert.equal((await a('dashboard')).tasks.length, 1);
  await a(`pets/${pet.id}/archive`, { archived: false }); assert.equal((await a('dashboard')).pets[0].archived, 0);
});

test('M9 v1 migration preserves users, sessions and tasks; leaving is not undone on restart', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'pawroster-legacy-')), path = join(dir, 'legacy.db');
  const raw = new DatabaseSync(path), cookie = 'a'.repeat(48), hash = createHash('sha256').update(cookie).digest('hex');
  raw.exec(`CREATE TABLE homes(id INTEGER PRIMARY KEY,name TEXT NOT NULL,invite TEXT NOT NULL UNIQUE);
    CREATE TABLE users(id INTEGER PRIMARY KEY,home_id INTEGER NOT NULL REFERENCES homes(id),name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,password TEXT NOT NULL);
    CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE pets(id INTEGER PRIMARY KEY,home_id INTEGER NOT NULL REFERENCES homes(id),name TEXT NOT NULL,species TEXT NOT NULL);
    CREATE TABLE tasks(id INTEGER PRIMARY KEY,pet_id INTEGER NOT NULL REFERENCES pets(id),title TEXT NOT NULL,due TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','claimed','done')),assignee INTEGER REFERENCES users(id),completed_at TEXT,note TEXT NOT NULL DEFAULT '');
    CREATE TABLE events(id INTEGER PRIMARY KEY,task_id INTEGER NOT NULL REFERENCES tasks(id),actor INTEGER NOT NULL REFERENCES users(id),action TEXT NOT NULL,at TEXT NOT NULL);
    INSERT INTO homes VALUES(1,'Legacy home','legacy-invite');
    INSERT INTO users VALUES(1,1,'Owner','owner@example.com','salt','hash'),(2,1,'Member','member@example.com','salt','hash');
    INSERT INTO pets VALUES(1,1,'Legacy cat','cat');
    INSERT INTO tasks VALUES(1,1,'Legacy care','2026-11-12T10:00:00.000Z','done',1,'2026-11-12T10:01:00.000Z','Preserved');
    PRAGMA user_version=1;`);
  raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash, 2, Date.now() + 3600000); raw.close();
  let app = createApp({ dbPath: path });
  const start = async () => { await new Promise(r => app.server.listen(0, '127.0.0.1', r)); return `http://127.0.0.1:${app.server.address().port}`; };
  let url = await start();
  t.after(async () => { await new Promise(r => app.server.close(r)); app.db.close(); rmSync(dir, { recursive: true, force: true }); });
  const request = async (endpoint, data) => { const res = await fetch(url + '/api/' + endpoint, { method: data ? 'POST' : 'GET', headers: { Cookie: 'session=' + cookie, ...(data ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) }); assert.equal(res.status, 200); return res.json(); };
  const state = await request('dashboard'); assert.equal(state.user.role, 'member'); assert.equal(state.tasks[0].note, 'Preserved'); assert.equal(app.db.prepare('SELECT role FROM memberships WHERE user_id=1').get().role, 'owner');
  await request('homes/leave', {}); await new Promise(r => app.server.close(r)); app.db.close();
  app = createApp({ dbPath: path }); url = await start();
  assert.equal((await request('dashboard')).homes.length, 0); assert.equal(app.db.prepare('PRAGMA user_version').get().user_version, 2);
});
