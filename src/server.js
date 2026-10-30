import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(24).toString('hex');
const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
function field(body, key, max = 120) {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, `ข้อมูล ${key} ไม่ถูกต้อง`);
  return value.trim();
}

export function createApp({ dbPath = process.env.DB_PATH || './data/pawroster.db', secureCookie = process.env.COOKIE_SECURE === 'true' } = {}) {
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS homes(id INTEGER PRIMARY KEY, name TEXT NOT NULL, invite TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, home_id INTEGER NOT NULL REFERENCES homes(id), name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS pets(id INTEGER PRIMARY KEY, home_id INTEGER NOT NULL REFERENCES homes(id), name TEXT NOT NULL, species TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY, pet_id INTEGER NOT NULL REFERENCES pets(id), title TEXT NOT NULL, due TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','claimed','done')), assignee INTEGER REFERENCES users(id), completed_at TEXT, note TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id), actor INTEGER NOT NULL REFERENCES users(id), action TEXT NOT NULL, at TEXT NOT NULL);
    PRAGMA user_version=1;`);
  const attempts = new Map();
  function throttle(req) {
    const key = req.socket.remoteAddress;
    const now = Date.now();
    let a = attempts.get(key);
    if (!a || a.until < now) { a = { count: 0, until: now + 60000 }; attempts.set(key, a); }
    if (++a.count > 30) fail(429, 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอหนึ่งนาที');
    if (attempts.size > 1000) for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  }
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  function session(res, userId) {
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    const raw = token();
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(raw), userId, Date.now() + 86400000);
    res.setHeader('Set-Cookie', `session=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${secureCookie ? '; Secure' : ''}`);
  }
  function rawSession(req) { return /(?:^|;\s*)session=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1] || ''; }
  function auth(req) {
    const user = db.prepare('SELECT u.id,u.home_id,u.name,u.email,h.name home_name,h.invite FROM sessions s JOIN users u ON u.id=s.user_id JOIN homes h ON h.id=u.home_id WHERE s.token=? AND s.expires>?').get(hash(rawSession(req)), Date.now());
    if (!user) fail(401, 'กรุณาเข้าสู่ระบบ');
    return user;
  }
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'ต้องส่งข้อมูล JSON');
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 16384) fail(413, 'ข้อมูลใหญ่เกินไป'); chunks.push(chunk); }
    try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!v || Array.isArray(v) || typeof v !== 'object') throw 0; return v; }
    catch { fail(400, 'JSON ไม่ถูกต้อง'); }
  }
  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Cache-Control', 'no-store');
    let path = '/';
    try {
      path = new URL(req.url, 'http://localhost').pathname;
      if (req.method !== 'GET' && req.headers.origin) {
        let origin; try { origin = new URL(req.headers.origin); } catch { fail(403, 'Origin ไม่ถูกต้อง'); }
        if (origin.host !== req.headers.host) fail(403, 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น');
      }
      if (req.method === 'GET' && path === '/health') {
        db.prepare('SELECT 1').get(); return send(200, { status: 'ok', version: '1.0.0', revision: process.env.APP_REVISION || 'development' });
      }
      if (req.method === 'GET' && ['/', '/app.js', '/style.css'].includes(path)) {
        const file = path === '/' ? 'index.html' : path.slice(1);
        res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8' });
        return res.end(readFileSync(resolve(publicDir, file)));
      }
      if (req.method === 'POST' && path === '/api/register') {
        throttle(req);
        const b = await body(req), name = field(b, 'name', 60), email = field(b, 'email', 160).toLowerCase();
        const password = field(b, 'password', 128);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) fail(400, 'ใช้อีเมลที่ถูกต้องและรหัสผ่านอย่างน้อย 10 ตัว');
        const salt = randomBytes(16).toString('hex'), digest = scryptSync(password, salt, 64).toString('hex');
        if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) fail(409, 'ไม่สามารถสมัครด้วยอีเมลนี้ได้');
        const id = transaction(() => {
          let home;
          if (b.invite) { home = db.prepare('SELECT id FROM homes WHERE invite=?').get(field(b, 'invite', 48)); if (!home) fail(400, 'รหัสเข้าร่วมบ้านไม่ถูกต้อง'); }
          else { home = { id: Number(db.prepare('INSERT INTO homes(name,invite) VALUES (?,?)').run(field(b, 'home', 60), randomBytes(12).toString('hex')).lastInsertRowid) }; }
          return Number(db.prepare('INSERT INTO users(home_id,name,email,salt,password) VALUES (?,?,?,?,?)').run(home.id, name, email, salt, digest).lastInsertRowid);
        });
        session(res, id); return send(201, { id });
      }
      if (req.method === 'POST' && path === '/api/login') {
        throttle(req); const b = await body(req);
        const email = field(b, 'email', 160).toLowerCase(), password = field(b, 'password', 128);
        const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
        const digest = scryptSync(password, u?.salt || 'dummy-auth-salt', 64);
        if (!u || !timingSafeEqual(digest, Buffer.from(u.password, 'hex'))) fail(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        session(res, u.id); return send(200, { id: u.id });
      }
      if (!path.startsWith('/api/')) fail(404, 'ไม่พบรายการ');
      const u = auth(req);
      if (req.method === 'POST' && path === '/api/logout') {
        db.prepare('DELETE FROM sessions WHERE token=?').run(hash(rawSession(req)));
        res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return send(200, { ok: true });
      }
      if (req.method === 'GET' && path === '/api/dashboard') {
        const pets = db.prepare('SELECT id,name,species FROM pets WHERE home_id=? ORDER BY id DESC').all(u.home_id);
        const tasks = db.prepare(`SELECT t.*,p.name pet_name,a.name assignee_name FROM tasks t JOIN pets p ON p.id=t.pet_id LEFT JOIN users a ON a.id=t.assignee WHERE p.home_id=? ORDER BY t.due,t.id`).all(u.home_id);
        const events = db.prepare(`SELECT e.*,u.name actor_name,t.title,p.name pet_name FROM events e JOIN users u ON u.id=e.actor JOIN tasks t ON t.id=e.task_id JOIN pets p ON p.id=t.pet_id WHERE p.home_id=? ORDER BY e.id DESC LIMIT 50`).all(u.home_id);
        return send(200, { user: u, pets, tasks, events });
      }
      if (req.method === 'POST' && path === '/api/pets') {
        const b = await body(req), name = field(b, 'name', 60), species = field(b, 'species', 30);
        const result = db.prepare('INSERT INTO pets(home_id,name,species) VALUES (?,?,?)').run(u.home_id, name, species);
        return send(201, { id: Number(result.lastInsertRowid) });
      }
      if (req.method === 'POST' && path === '/api/tasks') {
        const b = await body(req), title = field(b, 'title', 100), due = field(b, 'due', 40);
        if (!Number.isInteger(b.pet_id) || !db.prepare('SELECT id FROM pets WHERE id=? AND home_id=?').get(b.pet_id, u.home_id)) fail(404, 'ไม่พบสัตว์เลี้ยง');
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(due) || !Number.isFinite(Date.parse(due)) || new Date(due).toISOString() !== due) fail(400, 'วันเวลาไม่ถูกต้อง');
        const id = transaction(() => {
          const r = db.prepare('INSERT INTO tasks(pet_id,title,due) VALUES (?,?,?)').run(b.pet_id, title, new Date(due).toISOString());
          db.prepare('INSERT INTO events(task_id,actor,action,at) VALUES (?,?,?,?)').run(r.lastInsertRowid, u.id, 'created', new Date().toISOString());
          return Number(r.lastInsertRowid);
        });
        return send(201, { id });
      }
      const match = /^\/api\/tasks\/([1-9]\d*)\/(claim|complete|release)$/.exec(path);
      if (req.method === 'POST' && match) {
        const b = await body(req), id = Number(match[1]), action = match[2];
        transaction(() => {
          const t = db.prepare('SELECT t.* FROM tasks t JOIN pets p ON p.id=t.pet_id WHERE t.id=? AND p.home_id=?').get(id, u.home_id);
          if (!t) fail(404, 'ไม่พบงาน');
          const at = new Date().toISOString();
          if (action === 'claim') {
            if (t.status !== 'open') fail(409, 'งานนี้มีผู้รับผิดชอบหรือทำเสร็จแล้ว กรุณาโหลดข้อมูลล่าสุด');
            db.prepare("UPDATE tasks SET status='claimed',assignee=? WHERE id=?").run(u.id, id);
          } else {
            if (t.status !== 'claimed') fail(409, 'สถานะงานเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด');
            if (t.assignee !== u.id) fail(403, 'เฉพาะผู้รับงานเท่านั้นที่เปลี่ยนสถานะได้');
            if (action === 'release') db.prepare("UPDATE tasks SET status='open',assignee=NULL WHERE id=?").run(id);
            else {
              if (b.note !== undefined && (typeof b.note !== 'string' || b.note.length > 500)) fail(400, 'บันทึกต้องไม่เกิน 500 ตัวอักษร');
              db.prepare("UPDATE tasks SET status='done',completed_at=?,note=? WHERE id=?").run(at, b.note || '', id);
            }
          }
          db.prepare('INSERT INTO events(task_id,actor,action,at) VALUES (?,?,?,?)').run(id, u.id, action, at);
        });
        return send(200, { ok: true });
      }
      fail(404, 'ไม่พบรายการ');
    } catch (e) {
      if (!e.status) console.error(JSON.stringify({ event: 'server_error', message: e.message }));
      send(e.status || 503, { error: e.status ? e.message : 'ระบบไม่พร้อมใช้งาน กรุณาลองใหม่' });
    } finally {
      console.log(JSON.stringify({ method: req.method, path, status: res.statusCode, ms: Date.now() - started }));
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return { server, db };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server, db } = createApp();
  server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('PawRoster listening on port ' + (process.env.PORT || 3000)));
  const stop = () => server.close(() => { db.close(); process.exit(0); });
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
