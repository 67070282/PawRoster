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
function optional(body, key, max) {
  if (body[key] === undefined) return '';
  if (typeof body[key] !== 'string' || body[key].length > max) fail(400, `ข้อมูล ${key} ไม่ถูกต้อง`);
  return body[key].trim();
}
function taskFields(b) {
  const title = field(b, 'title', 100), due = field(b, 'due', 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(due) || !Number.isFinite(Date.parse(due)) || new Date(due).toISOString() !== due) fail(400, 'วันเวลาไม่ถูกต้อง');
  const priority = b.priority ?? 'normal', recurrence = b.recurrence ?? 'none';
  if (!['normal', 'high'].includes(priority) || !['none', 'daily', 'weekly'].includes(recurrence)) fail(400, 'ลำดับความสำคัญหรือการทำซ้ำไม่ถูกต้อง');
  return { title, due, priority, recurrence };
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
    `);
  // One atomic migration. Legacy home_id remains only for compatibility with old backups.
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 2) { db.close(); throw new Error('Database schema is newer than this application'); }
  if (version < 2) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(`CREATE TABLE memberships(home_id INTEGER NOT NULL REFERENCES homes(id), user_id INTEGER NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('owner','member')), PRIMARY KEY(home_id,user_id));
        INSERT INTO memberships SELECT home_id,id,CASE WHEN id=(SELECT MIN(other.id) FROM users other WHERE other.home_id=users.home_id) THEN 'owner' ELSE 'member' END FROM users;
        ALTER TABLE sessions ADD COLUMN active_home_id INTEGER REFERENCES homes(id);
        UPDATE sessions SET active_home_id=(SELECT home_id FROM users WHERE users.id=sessions.user_id);
        ALTER TABLE pets ADD COLUMN notes TEXT NOT NULL DEFAULT '';
        ALTER TABLE pets ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE tasks ADD COLUMN created_by INTEGER REFERENCES users(id);
        ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal';
        ALTER TABLE tasks ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none';
        ALTER TABLE tasks ADD COLUMN cancelled_at TEXT;
        CREATE INDEX memberships_user ON memberships(user_id);
        CREATE INDEX pets_home ON pets(home_id);
        CREATE INDEX tasks_pet ON tasks(pet_id);
        PRAGMA user_version=2; COMMIT;`);
    } catch (e) { db.exec('ROLLBACK'); db.close(); throw e; }
  }
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
    db.prepare('INSERT INTO sessions(token,user_id,expires,active_home_id) VALUES (?,?,?,(SELECT home_id FROM memberships WHERE user_id=? ORDER BY home_id LIMIT 1))').run(hash(raw), userId, Date.now() + 86400000, userId);
    res.setHeader('Set-Cookie', `session=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${secureCookie ? '; Secure' : ''}`);
  }
  function rawSession(req) { return /(?:^|;\s*)session=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1] || ''; }
  function auth(req) {
    const user = db.prepare(`SELECT u.id,u.name,u.email,m.home_id,m.role,h.name home_name,h.invite
      FROM sessions s JOIN users u ON u.id=s.user_id
      LEFT JOIN memberships m ON m.user_id=u.id AND m.home_id=COALESCE(s.active_home_id,(SELECT home_id FROM memberships WHERE user_id=u.id ORDER BY home_id LIMIT 1))
      LEFT JOIN homes h ON h.id=m.home_id WHERE s.token=? AND s.expires>?`).get(hash(rawSession(req)), Date.now());
    if (!user) fail(401, 'กรุณาเข้าสู่ระบบ');
    if (user.role !== 'owner') delete user.invite;
    return user;
  }
  const homesFor = id => db.prepare('SELECT h.id,h.name,m.role,(SELECT COUNT(*) FROM memberships mm WHERE mm.home_id=h.id) member_count FROM memberships m JOIN homes h ON h.id=m.home_id WHERE m.user_id=? ORDER BY h.id').all(id);
  const audit = (task, actor, action) => db.prepare('INSERT INTO events(task_id,actor,action,at) VALUES (?,?,?,?)').run(task, actor, action, new Date().toISOString());
  const ownerOnly = u => { if (u.role !== 'owner') fail(403, 'เฉพาะเจ้าของบ้านเท่านั้นที่จัดการส่วนนี้ได้'); };
  const activate = (req, id) => db.prepare('UPDATE sessions SET active_home_id=? WHERE token=?').run(id, hash(rawSession(req)));
  function releaseMember(userId, homeId, actor) {
    const tasks = db.prepare("SELECT t.id FROM tasks t JOIN pets p ON p.id=t.pet_id WHERE p.home_id=? AND t.assignee=? AND t.status='claimed' AND t.cancelled_at IS NULL").all(homeId, userId);
    for (const t of tasks) { db.prepare("UPDATE tasks SET status='open',assignee=NULL WHERE id=?").run(t.id); audit(t.id, actor, 'member_release'); }
    db.prepare('DELETE FROM memberships WHERE home_id=? AND user_id=?').run(homeId, userId);
    db.prepare('UPDATE sessions SET active_home_id=NULL WHERE user_id=? AND active_home_id=?').run(userId, homeId);
  }
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'ต้องส่งข้อมูล JSON');
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 16384) fail(413, 'ข้อมูลใหญ่เกินไป'); chunks.push(chunk); }
    let v;
    try { v = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!v || Array.isArray(v) || typeof v !== 'object') throw 0; }
    catch { fail(400, 'JSON ไม่ถูกต้อง'); }
    // Permissions can change while a slow request uploads its JSON body.
    if (req.requestUser) {
      const current = auth(req), previous = req.requestUser;
      if (current.home_id !== previous.home_id || current.role !== previous.role) fail(409, 'สิทธิ์หรือบ้านที่ใช้งานเปลี่ยนแล้ว กรุณาอัปเดตข้อมูล');
    }
    return v;
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
        db.prepare('SELECT 1').get(); return send(200, { status: 'ok', version: '2.0.0', revision: process.env.APP_REVISION || 'development' });
      }
      if (req.method === 'GET' && ['/', '/app.js', '/style.css', '/pet-care.svg', '/cat.svg', '/dog.svg', '/paw.svg', '/fonts/Epilogue.ttf', '/fonts/NotoSansThai.ttf'].includes(path)) {
        const file = path === '/' ? 'index.html' : path.slice(1);
        const mime = file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.ttf') ? 'font/ttf' : 'text/html; charset=utf-8';
        res.writeHead(200, { 'Content-Type': mime });
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
          const userId = Number(db.prepare('INSERT INTO users(home_id,name,email,salt,password) VALUES (?,?,?,?,?)').run(home.id, name, email, salt, digest).lastInsertRowid);
          db.prepare('INSERT INTO memberships VALUES (?,?,?)').run(home.id, userId, b.invite ? 'member' : 'owner');
          return userId;
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
      req.requestUser = u;
      if (req.method === 'POST' && path === '/api/logout') {
        db.prepare('DELETE FROM sessions WHERE token=?').run(hash(rawSession(req)));
        res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return send(200, { ok: true });
      }
      if (req.method === 'GET' && path === '/api/homes') return send(200, { homes: homesFor(u.id), active_home_id: u.home_id });
      if (req.method === 'POST' && path === '/api/homes') {
        const b = await body(req);
        const id = transaction(() => {
          const home = db.prepare('INSERT INTO homes(name,invite) VALUES (?,?)').run(field(b, 'name', 60), randomBytes(12).toString('hex'));
          db.prepare('INSERT INTO memberships VALUES (?,?,?)').run(home.lastInsertRowid, u.id, 'owner');
          activate(req, home.lastInsertRowid); return Number(home.lastInsertRowid);
        });
        return send(201, { id });
      }
      if (req.method === 'POST' && path === '/api/homes/join') {
        throttle(req); const b = await body(req);
        const id = transaction(() => {
          const home = db.prepare('SELECT id FROM homes WHERE invite=?').get(field(b, 'invite', 48));
          if (!home) fail(400, 'รหัสเข้าร่วมบ้านไม่ถูกต้องหรือถูกเปลี่ยนแล้ว');
          if (db.prepare('SELECT 1 FROM memberships WHERE home_id=? AND user_id=?').get(home.id, u.id)) fail(409, 'คุณเป็นสมาชิกบ้านนี้แล้ว เลือกบ้านจากรายการเพื่อสลับได้เลย');
          db.prepare("INSERT INTO memberships VALUES (?,?,'member')").run(home.id, u.id); activate(req, home.id); return home.id;
        });
        return send(201, { id });
      }
      if (req.method === 'POST' && path === '/api/homes/switch') {
        const b = await body(req);
        if (!Number.isInteger(b.home_id) || !db.prepare('SELECT 1 FROM memberships WHERE home_id=? AND user_id=?').get(b.home_id, u.id)) fail(403, 'คุณไม่ได้เป็นสมาชิกบ้านนี้');
        activate(req, b.home_id); return send(200, { ok: true });
      }
      // The UI carries the displayed home on every write, protecting stale tabs after switching.
      if (req.method !== 'GET' && req.headers['x-home-id'] && String(u.home_id) !== req.headers['x-home-id']) fail(409, 'บ้านที่ใช้งานเปลี่ยนแล้ว กรุณาอัปเดตข้อมูลก่อนทำรายการ');
      if (req.method === 'GET' && path === '/api/dashboard') {
        const pets = db.prepare('SELECT id,name,species,notes,archived FROM pets WHERE home_id=? ORDER BY archived,id DESC').all(u.home_id);
        const tasks = db.prepare(`SELECT t.*,p.name pet_name,a.name assignee_name FROM tasks t JOIN pets p ON p.id=t.pet_id LEFT JOIN users a ON a.id=t.assignee WHERE p.home_id=? ORDER BY t.due,t.id`).all(u.home_id);
        const events = db.prepare(`SELECT e.*,u.name actor_name,t.title,p.name pet_name FROM events e JOIN users u ON u.id=e.actor JOIN tasks t ON t.id=e.task_id JOIN pets p ON p.id=t.pet_id WHERE p.home_id=? ORDER BY e.id DESC LIMIT 50`).all(u.home_id);
        const members = db.prepare('SELECT u.id,u.name,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.home_id=? ORDER BY m.role DESC,u.id').all(u.home_id);
        return send(200, { user: u, homes: homesFor(u.id), members, pets, tasks, events });
      }
      if (!u.home_id) fail(409, 'เลือกสร้างบ้านหรือเข้าร่วมบ้านก่อนเริ่มใช้งาน');
      if (req.method === 'POST' && path === '/api/homes/rename') {
        ownerOnly(u); const b = await body(req); db.prepare('UPDATE homes SET name=? WHERE id=?').run(field(b, 'name', 60), u.home_id); return send(200, { ok: true });
      }
      if (req.method === 'POST' && path === '/api/homes/invite/rotate') {
        ownerOnly(u); await body(req); db.prepare('UPDATE homes SET invite=? WHERE id=?').run(randomBytes(12).toString('hex'), u.home_id); return send(200, { ok: true });
      }
      if (req.method === 'POST' && path === '/api/homes/leave') {
        await body(req); if (u.role === 'owner') fail(409, 'โอนสิทธิ์เจ้าของบ้านให้สมาชิกอื่นก่อนออกจากบ้าน');
        transaction(() => releaseMember(u.id, u.home_id, u.id)); return send(200, { ok: true });
      }
      if (req.method === 'POST' && ['/api/homes/members/remove', '/api/homes/transfer'].includes(path)) {
        ownerOnly(u); const b = await body(req);
        transaction(() => {
          if (!Number.isInteger(b.user_id) || b.user_id === u.id || !db.prepare('SELECT 1 FROM memberships WHERE home_id=? AND user_id=?').get(u.home_id, b.user_id)) fail(400, 'เลือกสมาชิกคนอื่นในบ้าน');
          if (path.endsWith('/remove')) releaseMember(b.user_id, u.home_id, u.id);
          else { db.prepare("UPDATE memberships SET role='member' WHERE home_id=? AND user_id=?").run(u.home_id, u.id); db.prepare("UPDATE memberships SET role='owner' WHERE home_id=? AND user_id=?").run(u.home_id, b.user_id); }
        });
        return send(200, { ok: true });
      }
      if (req.method === 'POST' && path === '/api/pets') {
        const b = await body(req), name = field(b, 'name', 60), species = field(b, 'species', 30);
        const result = db.prepare('INSERT INTO pets(home_id,name,species,notes) VALUES (?,?,?,?)').run(u.home_id, name, species, optional(b, 'notes', 500));
        return send(201, { id: Number(result.lastInsertRowid) });
      }
      const petMatch = /^\/api\/pets\/([1-9]\d*)\/(edit|archive)$/.exec(path);
      if (req.method === 'POST' && petMatch) {
        const b = await body(req), id = Number(petMatch[1]);
        transaction(() => {
          if (!db.prepare('SELECT id FROM pets WHERE id=? AND home_id=?').get(id, u.home_id)) fail(404, 'ไม่พบสัตว์เลี้ยง');
          if (petMatch[2] === 'edit') db.prepare('UPDATE pets SET name=?,species=?,notes=? WHERE id=?').run(field(b, 'name', 60), field(b, 'species', 30), optional(b, 'notes', 500), id);
          else {
            ownerOnly(u);
            if (db.prepare("SELECT 1 FROM tasks WHERE pet_id=? AND status!='done' AND cancelled_at IS NULL").get(id)) fail(409, 'ยังมีงานดูแลที่ไม่เสร็จ กรุณาจัดการงานก่อนเก็บประวัติสัตว์เลี้ยง');
            if (typeof b.archived !== 'boolean') fail(400, 'สถานะไม่ถูกต้อง');
            db.prepare('UPDATE pets SET archived=? WHERE id=?').run(b.archived ? 1 : 0, id);
          }
        }); return send(200, { ok: true });
      }
      if (req.method === 'POST' && path === '/api/tasks') {
        const b = await body(req), { title, due, priority, recurrence } = taskFields(b);
        if (!Number.isInteger(b.pet_id) || !db.prepare('SELECT id FROM pets WHERE id=? AND home_id=? AND archived=0').get(b.pet_id, u.home_id)) fail(404, 'ไม่พบสัตว์เลี้ยงที่ใช้งานอยู่');
        const id = transaction(() => {
          const r = db.prepare('INSERT INTO tasks(pet_id,title,due,created_by,priority,recurrence) VALUES (?,?,?,?,?,?)').run(b.pet_id, title, due, u.id, priority, recurrence);
          db.prepare('INSERT INTO events(task_id,actor,action,at) VALUES (?,?,?,?)').run(r.lastInsertRowid, u.id, 'created', new Date().toISOString());
          return Number(r.lastInsertRowid);
        });
        return send(201, { id });
      }
      const match = /^\/api\/tasks\/([1-9]\d*)\/(claim|complete|release|edit|cancel)$/.exec(path);
      if (req.method === 'POST' && match) {
        const b = await body(req), id = Number(match[1]), action = match[2];
        transaction(() => {
          const t = db.prepare('SELECT t.* FROM tasks t JOIN pets p ON p.id=t.pet_id WHERE t.id=? AND p.home_id=?').get(id, u.home_id);
          if (!t) fail(404, 'ไม่พบงาน');
          if (t.cancelled_at) fail(409, 'งานนี้ถูกยกเลิกแล้ว');
          const at = new Date().toISOString();
          if (action === 'edit' || action === 'cancel') {
            if (u.role !== 'owner' && t.created_by !== u.id) fail(403, 'เฉพาะผู้สร้างงานหรือเจ้าของบ้านที่แก้ไขหรือยกเลิกได้');
            if (t.status === 'done') fail(409, 'งานที่เสร็จแล้วเก็บไว้เป็นประวัติ');
            if (action === 'cancel') db.prepare('UPDATE tasks SET cancelled_at=? WHERE id=?').run(at, id);
            else {
              if (t.status !== 'open') fail(409, 'คืนงานก่อนแก้ไขรายละเอียด');
              const f = taskFields(b);
              db.prepare('UPDATE tasks SET title=?,due=?,priority=?,recurrence=? WHERE id=?').run(f.title, f.due, f.priority, f.recurrence, id);
            }
          } else if (action === 'claim') {
            if (t.status !== 'open') fail(409, 'งานนี้มีผู้รับผิดชอบหรือทำเสร็จแล้ว กรุณาโหลดข้อมูลล่าสุด');
            db.prepare("UPDATE tasks SET status='claimed',assignee=? WHERE id=?").run(u.id, id);
          } else {
            if (t.status !== 'claimed') fail(409, 'สถานะงานเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด');
            if (t.assignee !== u.id) fail(403, 'เฉพาะผู้รับงานเท่านั้นที่เปลี่ยนสถานะได้');
            if (action === 'release') db.prepare("UPDATE tasks SET status='open',assignee=NULL WHERE id=?").run(id);
            else {
              if (b.note !== undefined && (typeof b.note !== 'string' || b.note.length > 500)) fail(400, 'บันทึกต้องไม่เกิน 500 ตัวอักษร');
              db.prepare("UPDATE tasks SET status='done',completed_at=?,note=? WHERE id=?").run(at, b.note || '', id);
              if (t.recurrence !== 'none') {
                const nextDue = new Date(Date.parse(t.due) + (t.recurrence === 'daily' ? 1 : 7) * 86400000).toISOString();
                const next = db.prepare('INSERT INTO tasks(pet_id,title,due,created_by,priority,recurrence) VALUES (?,?,?,?,?,?)').run(t.pet_id, t.title, nextDue, t.created_by || u.id, t.priority, t.recurrence);
                audit(next.lastInsertRowid, u.id, 'created');
              }
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
