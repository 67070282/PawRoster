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
function isoTime(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail(400, `${label}ไม่ถูกต้อง`);
  return value;
}
function petFields(b) {
  const birth_date = optional(b, 'birth_date', 10), sex = b.sex ?? 'unknown';
  if (birth_date && (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date) || !Number.isFinite(Date.parse(birth_date + 'T00:00:00.000Z')) || new Date(birth_date + 'T00:00:00.000Z').toISOString().slice(0, 10) !== birth_date || birth_date > new Date().toISOString().slice(0, 10))) fail(400, 'วันเกิดไม่ถูกต้องหรืออยู่ในอนาคต');
  if (!['unknown', 'male', 'female'].includes(sex)) fail(400, 'ข้อมูลเพศไม่ถูกต้อง');
  return [field(b, 'name', 60), field(b, 'species', 30), optional(b, 'notes', 500), optional(b, 'breed', 60), birth_date, sex];
}
function recordFields(b) {
  const kind = field(b, 'kind', 20), title = field(b, 'title', 100), recorded_at = isoTime(b.recorded_at, 'วันที่บันทึก');
  if (!['weight', 'vaccine', 'visit', 'note'].includes(kind)) fail(400, 'ประเภทบันทึกไม่ถูกต้อง');
  const weight_kg = kind === 'weight' ? b.weight_kg : null;
  if (kind === 'weight' && (typeof weight_kg !== 'number' || !Number.isFinite(weight_kg) || weight_kg <= 0 || weight_kg > 2000)) fail(400, 'น้ำหนักต้องมากกว่า 0 และไม่เกิน 2000 กิโลกรัม');
  const due_at = b.due_at ? isoTime(b.due_at, 'วันนัดหมาย') : null;
  if (due_at && !['vaccine', 'visit'].includes(kind)) fail(400, 'นัดหมายใช้กับวัคซีนหรือพบสัตวแพทย์เท่านั้น');
  return [kind, title, recorded_at, weight_kg, due_at, optional(b, 'notes', 1000)];
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
  // Versioned atomic migrations. Legacy home_id remains for compatibility with old backups.
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 4) { db.close(); throw new Error('Database schema is newer than this application'); }
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
  if (version < 3) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(`ALTER TABLE pets ADD COLUMN deleted_at TEXT;
        ALTER TABLE pets ADD COLUMN breed TEXT NOT NULL DEFAULT '';
        ALTER TABLE pets ADD COLUMN birth_date TEXT NOT NULL DEFAULT '';
        ALTER TABLE pets ADD COLUMN sex TEXT NOT NULL DEFAULT 'unknown';
        ALTER TABLE events ADD COLUMN detail TEXT NOT NULL DEFAULT '';
        CREATE TABLE pet_records(id INTEGER PRIMARY KEY,pet_id INTEGER NOT NULL REFERENCES pets(id),created_by INTEGER NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('weight','vaccine','visit','note')),title TEXT NOT NULL,recorded_at TEXT NOT NULL,weight_kg REAL,due_at TEXT,notes TEXT NOT NULL DEFAULT '',resolved_at TEXT,updated_at TEXT NOT NULL);
        CREATE INDEX pet_records_pet ON pet_records(pet_id,recorded_at);
        PRAGMA user_version=3; COMMIT;`);
    } catch (e) { db.exec('ROLLBACK'); db.close(); throw e; }
  }
  if (version < 4) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(`ALTER TABLE homes ADD COLUMN invite_enabled INTEGER NOT NULL DEFAULT 1;
        CREATE TABLE home_blocks(home_id INTEGER NOT NULL REFERENCES homes(id),user_id INTEGER NOT NULL REFERENCES users(id),blocked_by INTEGER NOT NULL REFERENCES users(id),blocked_at TEXT NOT NULL,PRIMARY KEY(home_id,user_id));
        CREATE TABLE home_events(id INTEGER PRIMARY KEY,home_id INTEGER NOT NULL REFERENCES homes(id),actor INTEGER NOT NULL REFERENCES users(id),action TEXT NOT NULL,target INTEGER REFERENCES users(id),at TEXT NOT NULL);
        CREATE INDEX home_events_home ON home_events(home_id,id);
        PRAGMA user_version=4; COMMIT;`);
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
    const user = db.prepare(`SELECT u.id,u.name,u.email,m.home_id,m.role,h.name home_name,h.invite,h.invite_enabled
      FROM sessions s JOIN users u ON u.id=s.user_id
      LEFT JOIN memberships m ON m.user_id=u.id AND m.home_id=COALESCE(s.active_home_id,(SELECT home_id FROM memberships WHERE user_id=u.id ORDER BY home_id LIMIT 1))
      LEFT JOIN homes h ON h.id=m.home_id WHERE s.token=? AND s.expires>?`).get(hash(rawSession(req)), Date.now());
    if (!user) fail(401, 'กรุณาเข้าสู่ระบบ');
    if (user.role !== 'owner') delete user.invite;
    return user;
  }
  const homesFor = id => db.prepare('SELECT h.id,h.name,m.role,(SELECT COUNT(*) FROM memberships mm WHERE mm.home_id=h.id) member_count FROM memberships m JOIN homes h ON h.id=m.home_id WHERE m.user_id=? ORDER BY h.id').all(id);
  const audit = (task, actor, action, detail = '') => db.prepare('INSERT INTO events(task_id,actor,action,at,detail) VALUES (?,?,?,?,?)').run(task, actor, action, new Date().toISOString(), detail);
  const homeAudit = (home, actor, action, target = null) => db.prepare('INSERT INTO home_events(home_id,actor,action,target,at) VALUES (?,?,?,?,?)').run(home, actor, action, target, new Date().toISOString());
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
        db.prepare('SELECT 1').get(); return send(200, { status: 'ok', version: '2.2.0', revision: process.env.APP_REVISION || 'development' });
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
          if (b.invite) { home = db.prepare('SELECT id FROM homes WHERE invite=? AND invite_enabled=1').get(field(b, 'invite', 48)); if (!home) fail(400, 'รหัสเข้าร่วมบ้านไม่ถูกต้อง ถูกเปลี่ยน หรือบ้านพักรับสมาชิก'); }
          else { home = { id: Number(db.prepare('INSERT INTO homes(name,invite) VALUES (?,?)').run(field(b, 'home', 60), randomBytes(12).toString('hex')).lastInsertRowid) }; }
          const userId = Number(db.prepare('INSERT INTO users(home_id,name,email,salt,password) VALUES (?,?,?,?,?)').run(home.id, name, email, salt, digest).lastInsertRowid);
          db.prepare('INSERT INTO memberships VALUES (?,?,?)').run(home.id, userId, b.invite ? 'member' : 'owner');
          homeAudit(home.id, userId, b.invite ? 'member_joined' : 'home_created');
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
          homeAudit(home.lastInsertRowid, u.id, 'home_created');
          activate(req, home.lastInsertRowid); return Number(home.lastInsertRowid);
        });
        return send(201, { id });
      }
      if (req.method === 'POST' && path === '/api/homes/join') {
        throttle(req); const b = await body(req);
        const id = transaction(() => {
          const home = db.prepare('SELECT id FROM homes WHERE invite=? AND invite_enabled=1').get(field(b, 'invite', 48));
          if (!home) fail(400, 'รหัสเข้าร่วมบ้านไม่ถูกต้อง ถูกเปลี่ยน หรือบ้านพักรับสมาชิก');
          if (db.prepare('SELECT 1 FROM home_blocks WHERE home_id=? AND user_id=?').get(home.id,u.id)) fail(403, 'บัญชีนี้ถูกบล็อกจากบ้าน กรุณาติดต่อเจ้าของบ้าน');
          if (db.prepare('SELECT 1 FROM memberships WHERE home_id=? AND user_id=?').get(home.id, u.id)) fail(409, 'คุณเป็นสมาชิกบ้านนี้แล้ว เลือกบ้านจากรายการเพื่อสลับได้เลย');
          db.prepare("INSERT INTO memberships VALUES (?,?,'member')").run(home.id, u.id); homeAudit(home.id,u.id,'member_joined'); activate(req, home.id); return home.id;
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
        const pets = db.prepare('SELECT id,name,species,notes,archived,deleted_at,breed,birth_date,sex FROM pets WHERE home_id=? ORDER BY archived,id DESC').all(u.home_id);
        const tasks = db.prepare(`SELECT t.*,p.name pet_name,p.deleted_at pet_deleted_at,a.name assignee_name FROM tasks t JOIN pets p ON p.id=t.pet_id LEFT JOIN users a ON a.id=t.assignee WHERE p.home_id=? ORDER BY t.due,t.id`).all(u.home_id);
        const events = db.prepare(`SELECT e.*,u.name actor_name,t.title,p.name pet_name FROM events e JOIN users u ON u.id=e.actor JOIN tasks t ON t.id=e.task_id JOIN pets p ON p.id=t.pet_id WHERE p.home_id=? ORDER BY e.id DESC LIMIT 50`).all(u.home_id);
        const members = db.prepare('SELECT u.id,u.name,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.home_id=? ORDER BY m.role DESC,u.id').all(u.home_id);
        const records = db.prepare('SELECT r.*,p.name pet_name,p.deleted_at pet_deleted_at,a.name author_name FROM pet_records r JOIN pets p ON p.id=r.pet_id JOIN users a ON a.id=r.created_by WHERE p.home_id=? ORDER BY r.recorded_at DESC,r.id DESC').all(u.home_id);
        const blocked_members = u.role === 'owner' ? db.prepare('SELECT b.user_id,u.name,b.blocked_at FROM home_blocks b JOIN users u ON u.id=b.user_id WHERE b.home_id=? ORDER BY b.blocked_at DESC').all(u.home_id) : [];
        const security_events = u.role === 'owner' ? db.prepare('SELECT e.id,e.action,e.at,a.name actor_name,t.name target_name FROM home_events e JOIN users a ON a.id=e.actor LEFT JOIN users t ON t.id=e.target WHERE e.home_id=? ORDER BY e.id DESC LIMIT 30').all(u.home_id) : [];
        return send(200, { user: u, homes: homesFor(u.id), members, pets, tasks, events, records, blocked_members, security_events });
      }
      if (!u.home_id) fail(409, 'เลือกสร้างบ้านหรือเข้าร่วมบ้านก่อนเริ่มใช้งาน');
      if (req.method === 'POST' && path === '/api/homes/rename') {
        ownerOnly(u); const b = await body(req); transaction(()=>{ db.prepare('UPDATE homes SET name=? WHERE id=?').run(field(b, 'name', 60), u.home_id); homeAudit(u.home_id,u.id,'home_renamed'); }); return send(200, { ok: true });
      }
      if (req.method === 'POST' && path === '/api/homes/invite/rotate') {
        ownerOnly(u); await body(req); transaction(()=>{ db.prepare('UPDATE homes SET invite=? WHERE id=?').run(randomBytes(12).toString('hex'), u.home_id); homeAudit(u.home_id,u.id,'invite_rotated'); }); return send(200, { ok: true });
      }
      if (req.method === 'POST' && path === '/api/homes/invite/toggle') {
        ownerOnly(u); const b=await body(req); if(typeof b.enabled !== 'boolean') fail(400,'สถานะการรับสมาชิกไม่ถูกต้อง');
        transaction(()=>{db.prepare('UPDATE homes SET invite_enabled=?,invite=? WHERE id=?').run(Number(b.enabled),randomBytes(12).toString('hex'),u.home_id);homeAudit(u.home_id,u.id,b.enabled?'invites_opened':'invites_paused');});return send(200,{ok:true});
      }
      if (req.method === 'POST' && path === '/api/homes/members/unblock') {
        ownerOnly(u);const b=await body(req);
        transaction(()=>{if(!Number.isInteger(b.user_id)||!db.prepare('SELECT 1 FROM home_blocks WHERE home_id=? AND user_id=?').get(u.home_id,b.user_id))fail(404,'ไม่พบบัญชีในรายการบล็อกของบ้านนี้');db.prepare('DELETE FROM home_blocks WHERE home_id=? AND user_id=?').run(u.home_id,b.user_id);homeAudit(u.home_id,u.id,'member_unblocked',b.user_id);});return send(200,{ok:true});
      }
      if (req.method === 'POST' && path === '/api/homes/leave') {
        await body(req); if (u.role === 'owner') fail(409, 'โอนสิทธิ์เจ้าของบ้านให้สมาชิกอื่นก่อนออกจากบ้าน');
        transaction(() => {releaseMember(u.id, u.home_id, u.id);homeAudit(u.home_id,u.id,'member_left');}); return send(200, { ok: true });
      }
      if (req.method === 'POST' && ['/api/homes/members/remove', '/api/homes/transfer'].includes(path)) {
        ownerOnly(u); const b = await body(req);
        transaction(() => {
          if (!Number.isInteger(b.user_id) || b.user_id === u.id || !db.prepare('SELECT 1 FROM memberships WHERE home_id=? AND user_id=?').get(u.home_id, b.user_id)) fail(400, 'เลือกสมาชิกคนอื่นในบ้าน');
          if (path.endsWith('/remove')) {
            db.prepare('INSERT INTO home_blocks(home_id,user_id,blocked_by,blocked_at) VALUES (?,?,?,?)').run(u.home_id,b.user_id,u.id,new Date().toISOString());
            releaseMember(b.user_id, u.home_id, u.id);
            db.prepare('UPDATE homes SET invite=? WHERE id=?').run(randomBytes(12).toString('hex'),u.home_id);
            homeAudit(u.home_id,u.id,'member_removed',b.user_id);homeAudit(u.home_id,u.id,'invite_rotated');
          }
          else { db.prepare("UPDATE memberships SET role='member' WHERE home_id=? AND user_id=?").run(u.home_id, u.id); db.prepare("UPDATE memberships SET role='owner' WHERE home_id=? AND user_id=?").run(u.home_id, b.user_id); homeAudit(u.home_id,u.id,'owner_transferred',b.user_id); }
        });
        return send(200, { ok: true });
      }
      if (req.method === 'POST' && path === '/api/pets') {
        const b = await body(req), fields = petFields(b);
        const result = db.prepare('INSERT INTO pets(home_id,name,species,notes,breed,birth_date,sex) VALUES (?,?,?,?,?,?,?)').run(u.home_id, ...fields);
        return send(201, { id: Number(result.lastInsertRowid) });
      }
      const petMatch = /^\/api\/pets\/([1-9]\d*)\/(edit|archive|delete|restore|purge)$/.exec(path);
      if (req.method === 'POST' && petMatch) {
        const b = await body(req), id = Number(petMatch[1]);
        transaction(() => {
          const pet = db.prepare('SELECT * FROM pets WHERE id=? AND home_id=?').get(id, u.home_id);
          if (!pet) fail(404, 'ไม่พบสัตว์เลี้ยง');
          if (petMatch[2] === 'purge') {
            ownerOnly(u);
            if (!pet.deleted_at) fail(409, 'ย้ายสัตว์เลี้ยงไปถังขยะก่อนลบถาวร');
            if (b.confirm_name !== pet.name) fail(400, 'พิมพ์ชื่อสัตว์เลี้ยงให้ตรงเพื่อยืนยันการลบถาวร');
            if (b.deleted_at !== pet.deleted_at) fail(409, 'สถานะถังขยะเปลี่ยนแล้ว กรุณาเปิดรายการใหม่ก่อนลบถาวร');
            db.prepare('DELETE FROM events WHERE task_id IN (SELECT id FROM tasks WHERE pet_id=?)').run(id);
            db.prepare('DELETE FROM tasks WHERE pet_id=?').run(id);
            db.prepare('DELETE FROM pet_records WHERE pet_id=?').run(id);
            db.prepare('DELETE FROM pets WHERE id=?').run(id);
            return;
          }
          if (petMatch[2] === 'restore') {
            ownerOnly(u); if (!pet.deleted_at) fail(409, 'สัตว์เลี้ยงนี้ไม่ได้อยู่ในถังขยะ');
            db.prepare('UPDATE pets SET deleted_at=NULL,archived=0 WHERE id=?').run(id); return;
          }
          if (pet.deleted_at) fail(409, 'สัตว์เลี้ยงอยู่ในถังขยะ กู้คืนก่อนแก้ไข');
          if (petMatch[2] === 'delete') {
            ownerOnly(u);
            if (b.confirm_name !== pet.name) fail(400, 'พิมพ์ชื่อสัตว์เลี้ยงให้ตรงเพื่อยืนยันการลบ');
            const at = new Date().toISOString();
            for (const t of db.prepare("SELECT id FROM tasks WHERE pet_id=? AND status!='done' AND cancelled_at IS NULL").all(id)) {
              db.prepare('UPDATE tasks SET cancelled_at=? WHERE id=?').run(at, t.id); audit(t.id, u.id, 'pet_delete', pet.name);
            }
            db.prepare('UPDATE pets SET deleted_at=?,archived=1 WHERE id=?').run(at, id); return;
          }
          if (petMatch[2] === 'edit') db.prepare('UPDATE pets SET name=?,species=?,notes=?,breed=?,birth_date=?,sex=? WHERE id=?').run(...petFields(b), id);
          else {
            ownerOnly(u);
            if (db.prepare("SELECT 1 FROM tasks WHERE pet_id=? AND status!='done' AND cancelled_at IS NULL").get(id)) fail(409, 'ยังมีงานดูแลที่ไม่เสร็จ กรุณาจัดการงานก่อนเก็บประวัติสัตว์เลี้ยง');
            if (typeof b.archived !== 'boolean') fail(400, 'สถานะไม่ถูกต้อง');
            db.prepare('UPDATE pets SET archived=? WHERE id=?').run(b.archived ? 1 : 0, id);
          }
        }); return send(200, { ok: true });
      }
      if (req.method === 'POST' && path === '/api/records') {
        const b = await body(req), fields = recordFields(b);
        if (!Number.isInteger(b.pet_id) || !db.prepare('SELECT id FROM pets WHERE id=? AND home_id=? AND deleted_at IS NULL').get(b.pet_id, u.home_id)) fail(404, 'ไม่พบสัตว์เลี้ยง');
        const r = db.prepare('INSERT INTO pet_records(pet_id,created_by,kind,title,recorded_at,weight_kg,due_at,notes,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(b.pet_id, u.id, ...fields, new Date().toISOString());
        return send(201, { id: Number(r.lastInsertRowid) });
      }
      const recordMatch = /^\/api\/records\/([1-9]\d*)\/(edit|delete|resolve)$/.exec(path);
      if (req.method === 'POST' && recordMatch) {
        const b = await body(req), id = Number(recordMatch[1]);
        transaction(() => {
          const r = db.prepare('SELECT r.*,p.deleted_at FROM pet_records r JOIN pets p ON p.id=r.pet_id WHERE r.id=? AND p.home_id=?').get(id, u.home_id);
          if (!r) fail(404, 'ไม่พบบันทึก');
          if (r.deleted_at) fail(409, 'กู้คืนสัตว์เลี้ยงก่อนแก้ไขบันทึก');
          if (r.created_by !== u.id && u.role !== 'owner') fail(403, 'เฉพาะผู้บันทึกหรือเจ้าของบ้านที่จัดการได้');
          const at = new Date().toISOString();
          if (recordMatch[2] === 'delete') db.prepare('DELETE FROM pet_records WHERE id=?').run(id);
          else if (recordMatch[2] === 'resolve') {
            if (!r.due_at || typeof b.resolved !== 'boolean') fail(400, 'เลือกสถานะของรายการที่มีนัดหมาย');
            db.prepare('UPDATE pet_records SET resolved_at=?,updated_at=? WHERE id=?').run(b.resolved ? at : null, at, id);
          } else {
            const fields = recordFields(b);
            db.prepare('UPDATE pet_records SET kind=?,title=?,recorded_at=?,weight_kg=?,due_at=?,notes=?,resolved_at=?,updated_at=? WHERE id=?').run(...fields, fields[4] === r.due_at ? r.resolved_at : null, at, id);
          }
        }); return send(200, { ok: true });
      }
      if (req.method === 'POST' && path === '/api/tasks') {
        const b = await body(req), { title, due, priority, recurrence } = taskFields(b);
        if (!Number.isInteger(b.pet_id) || !db.prepare('SELECT id FROM pets WHERE id=? AND home_id=? AND archived=0 AND deleted_at IS NULL').get(b.pet_id, u.home_id)) fail(404, 'ไม่พบสัตว์เลี้ยงที่ใช้งานอยู่');
        const id = transaction(() => {
          const r = db.prepare('INSERT INTO tasks(pet_id,title,due,created_by,priority,recurrence) VALUES (?,?,?,?,?,?)').run(b.pet_id, title, due, u.id, priority, recurrence);
          db.prepare('INSERT INTO events(task_id,actor,action,at) VALUES (?,?,?,?)').run(r.lastInsertRowid, u.id, 'created', new Date().toISOString());
          return Number(r.lastInsertRowid);
        });
        return send(201, { id });
      }
      const match = /^\/api\/tasks\/([1-9]\d*)\/(claim|complete|release|edit|cancel|assign)$/.exec(path);
      if (req.method === 'POST' && match) {
        const b = await body(req), id = Number(match[1]), action = match[2];
        transaction(() => {
          const t = db.prepare('SELECT t.* FROM tasks t JOIN pets p ON p.id=t.pet_id WHERE t.id=? AND p.home_id=? AND p.deleted_at IS NULL').get(id, u.home_id);
          if (!t) fail(404, 'ไม่พบงาน');
          if (t.cancelled_at) fail(409, 'งานนี้ถูกยกเลิกแล้ว');
          const at = new Date().toISOString();
          if (action === 'assign') {
            ownerOnly(u); if (t.status !== 'open') fail(409, 'มอบหมายได้เฉพาะงานที่ยังไม่มีผู้รับผิดชอบ');
            const member = Number.isInteger(b.user_id) && db.prepare('SELECT u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.home_id=? AND m.user_id=?').get(u.home_id, b.user_id);
            if (!member) fail(400, 'เลือกสมาชิกในบ้านนี้');
            db.prepare("UPDATE tasks SET status='claimed',assignee=? WHERE id=?").run(b.user_id, id);
            audit(id, u.id, 'assign', member.name); return;
          } else if (action === 'edit' || action === 'cancel') {
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
