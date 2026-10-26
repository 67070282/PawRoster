import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.js';

test('HTTP acceptance: shared care, conflicts, privacy, validation and persistence', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'pawroster-'));
  let app = createApp({ dbPath: join(dir, 'test.db') });
  const listen = async () => { await new Promise(r => app.server.listen(0, '127.0.0.1', r)); return `http://127.0.0.1:${app.server.address().port}`; };
  let url = await listen();
  t.after(async () => { await new Promise(r => app.server.close(r)); app.db.close(); rmSync(dir, { recursive: true, force: true }); });
  function client() {
    let cookie = '';
    return async (path, data, expected = 200, headers = {}) => {
      const res = await fetch(url + path, { method: data === undefined ? 'GET' : 'POST', headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), Cookie: cookie, ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
      if (res.headers.get('set-cookie')) {
        assert.match(res.headers.get('set-cookie'), /HttpOnly/);
        assert.match(res.headers.get('set-cookie'), /SameSite=Strict/);
        cookie = res.headers.get('set-cookie').split(';')[0];
      }
      const result = await res.json(); assert.equal(res.status, expected, JSON.stringify(result)); return result;
    };
  }
  const a = client(), b = client(), outsider = client(), anonymous = client();
  let pet, task, invite;
  await t.test('R1 authentication and session cookie', async () => {
    await anonymous('/api/dashboard', undefined, 401);
    await a('/api/register', { name: 'A', home: 'Mochi House', email: 'a@example.com', password: 'test-password-123' }, 201);
    const state = await a('/api/dashboard'); invite = state.user.invite;
    assert.equal(state.user.home_name, 'Mochi House'); assert.equal(state.user.password, undefined);
    await anonymous('/api/login', { email: 'a@example.com', password: 'wrong-password' }, 401);
    await anonymous('/api/login', { email: 'a@example.com', password: 'test-password-123' });
    assert.equal((await anonymous('/api/dashboard')).user.email, 'a@example.com');
    await anonymous('/api/register', { name: 'x', home: 'x', email: 'invalid', password: 'short' }, 400);
    await a('/api/register', { name: 'A', home: 'x', email: 'a@example.com', password: 'test-password-123' }, 409);
  });
  await t.test('R2 join house, add real pet and scheduled task', async () => {
    await b('/api/register', { name: 'B', invite, email: 'b@example.com', password: 'test-password-123' }, 201);
    await outsider('/api/register', { name: 'C', home: 'Other', email: 'c@example.com', password: 'test-password-123' }, 201);
    pet = await a('/api/pets', { name: 'โมจิ', species: 'แมว' }, 201);
    task = await a('/api/tasks', { pet_id: pet.id, title: 'ให้อาหาร', due: '2026-10-27T10:00:00.000Z' }, 201);
    const shared = await b('/api/dashboard'); assert.equal(shared.tasks[0].id, task.id); assert.equal(shared.pets[0].name, 'โมจิ');
  });
  await t.test('R3 simultaneous claims have one winner', async () => {
    const results = await Promise.allSettled([a(`/api/tasks/${task.id}/claim`, {}), b(`/api/tasks/${task.id}/claim`, {})]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
    const state = await a('/api/dashboard'); assert.equal(state.events.filter(e => e.action === 'claim').length, 1);
    assert.equal(state.tasks[0].status, 'claimed');
  });
  await t.test('R4 owner-only completion, release and one audit record', async () => {
    const state = await a('/api/dashboard');
    const owner = state.tasks[0].assignee === state.user.id ? a : b;
    const other = owner === a ? b : a;
    await other(`/api/tasks/${task.id}/complete`, {}, 403);
    await owner(`/api/tasks/${task.id}/release`, {});
    await a(`/api/tasks/${task.id}/claim`, {});
    await a(`/api/tasks/${task.id}/complete`, { note: 'กินหมดแล้ว' });
    await a(`/api/tasks/${task.id}/complete`, {}, 409);
    const done = await b('/api/dashboard'); assert.equal(done.tasks[0].note, 'กินหมดแล้ว');
    assert.equal(done.tasks[0].status, 'done'); assert.equal(done.events.filter(e => e.action === 'complete').length, 1);
  });
  await t.test('R5 house isolation and cross-origin rejection', async () => {
    assert.equal((await outsider('/api/dashboard')).pets.length, 0);
    await outsider(`/api/tasks/${task.id}/claim`, {}, 404);
    await outsider('/api/tasks', { pet_id: pet.id, title: 'x', due: '2026-10-27T10:00:00.000Z' }, 404);
    await a('/api/pets', { name: 'x', species: 'x' }, 403, { Origin: 'https://evil.example' });
  });
  await t.test('R6 validation, injection treated as data, HTTP security', async () => {
    await a('/api/tasks', { pet_id: pet.id, title: 'x', due: 'bad-date' }, 400);
    await a('/api/tasks', { pet_id: pet.id, title: 'x', due: '2026-02-31T10:00:00.000Z' }, 400);
    await a('/api/pets', { name: '', species: 'cat' }, 400);
    await a('/api/pets', { name: "Robert'); DROP TABLE users;--", species: 'cat' }, 201);
    assert.equal((await a('/api/dashboard')).pets.length, 2);
    const res = await fetch(url + '/'); assert.equal(res.status, 200); assert.match(await res.text(), /PawRoster/);
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
    const malformed = await fetch(url + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' }); assert.equal(malformed.status, 400);
    const large = await fetch(url + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ x: 'x'.repeat(17000) }) }); assert.equal(large.status, 413);
  });
  await t.test('R7 restart retains database and session', async () => {
    await new Promise(r => app.server.close(r)); app.db.close();
    app = createApp({ dbPath: join(dir, 'test.db') }); url = await listen();
    const saved = await a('/api/dashboard'); assert.equal(saved.tasks[0].status, 'done'); assert.equal(saved.tasks[0].note, 'กินหมดแล้ว');
    assert.equal((await a('/health')).status, 'ok');
  });
  await t.test('R8 logout revokes session', async () => { await a('/api/logout', {}); await a('/api/dashboard', undefined, 401); });
});
