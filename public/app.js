const $ = id => document.getElementById(id);
let mode = 'login', state, completing;
function notice(message = '') { $('notice').textContent = message; $('notice').hidden = !message; }
async function api(path, data) {
  const res = await fetch('/api/' + path, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await res.json();
  if (!res.ok) { if (res.status === 401) showAuth(); throw new Error(result.error || 'เกิดข้อผิดพลาด'); }
  return result;
}
function el(tag, text, className) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e; }
function showAuth() { $('auth').hidden = false; $('dashboard').hidden = true; $('account').replaceChildren(); }
function date(value) { return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); }
async function run(button, fn) { button.disabled = true; notice(); try { await fn(); } catch (e) { notice(e.message === 'Failed to fetch' ? 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่' : e.message); } finally { button.disabled = false; } }
function button(text, fn, className = 'primary') { const b = el('button', text, className); b.type = 'button'; b.onclick = () => run(b, fn); return b; }
function setMode(value) {
  mode = value; $('registration').hidden = mode !== 'register';
  $('auth-submit').textContent = mode === 'login' ? 'เข้าสู่ระบบ →' : 'สร้างบัญชีและเข้าบ้าน →';
  $('login-tab').classList.toggle('selected', mode === 'login'); $('register-tab').classList.toggle('selected', mode === 'register');
  $('auth-form').elements.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password'; notice();
}
$('login-tab').onclick = () => setMode('login'); $('register-tab').onclick = () => setMode('register');
$('auth-form').onsubmit = e => { e.preventDefault(); run($('auth-submit'), async () => { await api(mode, Object.fromEntries(new FormData(e.target))); e.target.reset(); await load(); }); };
$('pet-form').onsubmit = e => { e.preventDefault(); run(e.submitter, async () => { await api('pets', Object.fromEntries(new FormData(e.target))); e.target.reset(); await load(); notice('เพิ่มสัตว์เลี้ยงแล้ว'); }); };
$('task-form').onsubmit = e => { e.preventDefault(); run(e.submitter, async () => { const data = Object.fromEntries(new FormData(e.target)); data.pet_id = Number(data.pet_id); data.due = new Date(data.due).toISOString(); await api('tasks', data); e.target.reset(); await load(); notice('เพิ่มงานดูแลแล้ว'); }); };
$('refresh').onclick = () => run($('refresh'), load);
$('filter').onchange = renderTasks;
$('cancel-complete').onclick = () => $('complete-dialog').close();
$('complete-form').onsubmit = e => { e.preventDefault(); run(e.submitter, async () => { try { await api(`tasks/${completing}/complete`, Object.fromEntries(new FormData(e.target))); $('complete-dialog').close(); e.target.reset(); await load(); notice('บันทึกการดูแลเรียบร้อยแล้ว ♡'); } catch (error) { $('complete-dialog').close(); await load().catch(() => {}); throw error; } }); };
async function action(id, type) { try { await api(`tasks/${id}/${type}`, {}); await load(); } catch (e) { await load().catch(() => {}); throw e; } }
function renderTasks() {
  const root = $('tasks'); root.replaceChildren();
  const tasks = state.tasks.filter(t => $('filter').value === 'all' || ($('filter').value === 'done' ? t.status === 'done' : t.status !== 'done'));
  if (!tasks.length) root.append(el('div', 'ยังไม่มีงานในมุมมองนี้ เพิ่มงานดูแลจากแบบฟอร์มได้เลย 🌿', 'empty'));
  for (const t of tasks) {
    const card = el('article', undefined, 'task'), info = el('div'), actions = el('div', undefined, 'actions');
    const late = t.status !== 'done' && new Date(t.due) < new Date();
    info.append(el('span', t.status === 'done' ? '✓ ทำแล้ว' : late ? 'เลยกำหนด' : t.status === 'claimed' ? 'มีผู้รับผิดชอบ' : 'รอคนรับงาน', 'badge ' + (t.status === 'done' ? 'done' : late ? 'late' : '')));
    info.append(el('h3', t.title), el('p', `${t.pet_name} · ${date(t.due)}`));
    if (t.assignee_name) info.append(el('p', `ผู้รับผิดชอบ: ${t.assignee_name}`));
    if (t.completed_at) info.append(el('p', `ทำเสร็จ: ${date(t.completed_at)}`));
    if (t.note) info.append(el('p', 'บันทึก: ' + t.note));
    if (t.status === 'open') actions.append(button('รับงานนี้', () => action(t.id, 'claim')));
    if (t.status === 'claimed' && t.assignee === state.user.id) {
      actions.append(button('✓ ทำแล้ว', () => { completing = t.id; $('complete-dialog').showModal(); }));
      actions.append(button('คืนงาน', () => action(t.id, 'release'), 'secondary'));
    }
    card.append(info, actions); root.append(card);
  }
}
async function load() {
  state = await api('dashboard'); $('auth').hidden = true; $('dashboard').hidden = false;
  $('home-title').textContent = state.user.home_name; $('greeting').textContent = `สวัสดี ${state.user.name} วันนี้มาช่วยกันดูแลเพื่อนตัวเล็กนะ`;
  $('account').replaceChildren(el('span', state.user.name), button('ออกจากระบบ', async () => { await api('logout', {}); showAuth(); }, 'secondary'));
  $('pending-count').textContent = state.tasks.filter(t => t.status !== 'done').length;
  $('overdue-count').textContent = state.tasks.filter(t => t.status !== 'done' && new Date(t.due) < new Date()).length;
  $('done-count').textContent = state.tasks.filter(t => t.status === 'done').length;
  $('invite').textContent = state.user.invite;
  const previousPet = $('pet-select').value;
  $('pets').replaceChildren(); $('pet-select').replaceChildren();
  if (!state.pets.length) $('pets').append(el('p', 'เริ่มด้วยการเพิ่มสัตว์เลี้ยงตัวแรก', 'hint'));
  for (const p of state.pets) { const pet = el('div', undefined, 'pet'); pet.append(el('b', p.name), el('span', p.species)); $('pets').append(pet); const opt = el('option', p.name); opt.value = p.id; $('pet-select').append(opt); }
  if (state.pets.some(p => String(p.id) === previousPet)) $('pet-select').value = previousPet;
  $('task-form').querySelector('button').disabled = !state.pets.length;
  $('events').replaceChildren();
  const labels = { created: 'เพิ่มงาน', claim: 'รับงาน', complete: 'ทำเสร็จ', release: 'คืนงาน' };
  for (const event of state.events) { const row = el('div', undefined, 'event'); row.append(el('span', `${event.actor_name} ${labels[event.action]} “${event.title}” ให้ ${event.pet_name}`), el('time', date(event.at))); $('events').append(row); }
  if (!state.events.length) $('events').append(el('p', 'กิจกรรมการดูแลจะปรากฏที่นี่', 'hint'));
  renderTasks();
}
load().catch(e => { showAuth(); if (e.message !== 'กรุณาเข้าสู่ระบบ') notice(e.message); });
