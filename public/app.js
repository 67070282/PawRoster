const $ = id => document.getElementById(id);
let mode = 'login', state, view = 'board', editingPet, editingTask, completing;
function notice(message = '') { $('notice').textContent = message; $('notice').hidden = !message; }
function el(tag, text, className) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e; }
function date(value) { return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); }
function localInput(value) { const d = new Date(value); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
const activeTask = t => t.status !== 'done' && !t.cancelled_at;
const isOwner = () => state?.user.role === 'owner';
function portrait(species, className) {
  const img = document.createElement('img');
  img.src = /แมว|cat/i.test(species) ? '/cat.svg' : /สุนัข|dog/i.test(species) ? '/dog.svg' : '/paw.svg';
  img.alt = ''; img.setAttribute('aria-hidden', 'true'); if (className) img.className = className; return img;
}
function closeDialogs() { document.querySelectorAll('dialog[open]').forEach(d => d.close()); }
function openDialog(id) { const d = $(id); d.querySelector('.dialog-error').textContent = ''; d.showModal(); }
async function api(path, data) {
  const headers = {};
  if (data !== undefined) { headers['Content-Type'] = 'application/json'; if (state?.user.home_id) headers['X-Home-ID'] = String(state.user.home_id); }
  const res = await fetch('/api/' + path, data === undefined ? {} : { method: 'POST', headers, body: JSON.stringify(data) });
  const result = await res.json();
  if (!res.ok) { if (res.status === 401) showAuth(); throw new Error(result.error || 'เกิดข้อผิดพลาด'); }
  return result;
}
async function run(control, fn) {
  if (control) control.disabled = true;
  const dialog = control?.closest('dialog');
  notice(); if (dialog) dialog.querySelector('.dialog-error').textContent = '';
  try { await fn(); }
  catch (e) {
    const message = e.message === 'Failed to fetch' ? 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่' : e.message;
    if (dialog?.open) dialog.querySelector('.dialog-error').textContent = message; else notice(message);
  } finally { if (control) control.disabled = false; }
}
function button(text, fn, className = 'secondary') { const b = el('button', text, className); b.type = 'button'; b.onclick = () => run(b, fn); return b; }
function showAuth() { state = undefined; closeDialogs(); $('auth').hidden = false; $('dashboard').hidden = true; $('account').replaceChildren(); }
function setMode(value) {
  mode = value; $('registration').hidden = mode !== 'register';
  $('auth-submit').textContent = mode === 'login' ? 'เข้าสู่ระบบ' : 'สร้างบัญชี';
  $('login-tab').classList.toggle('selected', mode === 'login'); $('register-tab').classList.toggle('selected', mode === 'register');
  $('auth-form').elements.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password'; notice();
}
function showView(next) {
  view = next;
  document.querySelectorAll('.view').forEach(e => { e.hidden = e.id !== 'view-' + next; });
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === next); if (b.dataset.view === next) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
}
function confirmAction(title, message, fn) {
  $('confirm-title').textContent = title; $('confirm-message').textContent = message;
  $('confirm-submit').onclick = () => run($('confirm-submit'), async () => { await fn(); $('confirm-dialog').close(); });
  openDialog('confirm-dialog');
}
async function mutate(path, data, message) { await api(path, data); await load(); notice(message); }
$('confirm-cancel').onclick = () => $('confirm-dialog').close();
document.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => $(b.dataset.close).close(); });
document.querySelectorAll('[data-view]').forEach(b => { b.onclick = () => showView(b.dataset.view); });
$('login-tab').onclick = () => setMode('login'); $('register-tab').onclick = () => setMode('register');
$('auth-form').onsubmit = e => { e.preventDefault(); run(e.submitter, async () => { await api(mode, Object.fromEntries(new FormData(e.target))); e.target.reset(); view = 'board'; await load(); }); };
$('refresh').onclick = () => run($('refresh'), load);
$('filter').onchange = renderTasks; $('pet-filter').onchange = renderTasks; $('sort').onchange = renderTasks; $('search').oninput = renderTasks;
function resetFilters() { $('filter').value = 'active'; $('pet-filter').value = 'all'; $('search').value = ''; $('sort').value = 'due'; }
async function switchHome(id) { await api('homes/switch', { home_id: Number(id) }); closeDialogs(); resetFilters(); view = 'board'; await load(); notice('เปลี่ยนบ้านที่ดูแลแล้ว'); }
$('home-switch').onchange = () => run($('home-switch'), async () => { try { await switchHome($('home-switch').value); } catch (e) { await load(); throw e; } });
function manageHomes() {
  $('home-list').replaceChildren();
  for (const h of state.homes) {
    const row = el('div', undefined, 'home-row'), info = el('div');
    info.append(el('b', h.name), el('p', `${h.role === 'owner' ? 'เจ้าของบ้าน' : 'สมาชิก'} · ${h.member_count} คน`, 'hint'));
    row.append(info, h.id === state.user.home_id ? el('span', 'กำลังดูแล') : button('สลับมาบ้านนี้', () => switchHome(h.id)));
    $('home-list').append(row);
  }
  if (!state.homes.length) $('home-list').append(el('p', 'ยังไม่ได้เป็นสมาชิกบ้านใด', 'hint'));
  $('join-home-form').reset(); $('create-home-form').reset(); openDialog('homes-dialog');
}
$('manage-homes').onclick = manageHomes; $('no-home-action').onclick = manageHomes;
for (const [formId, path] of [['join-home-form', 'homes/join'], ['create-home-form', 'homes']]) {
  $(formId).onsubmit = e => { e.preventDefault(); run(e.submitter, async () => { await api(path, Object.fromEntries(new FormData(e.target))); closeDialogs(); resetFilters(); view = 'board'; await load(); notice(formId === 'join-home-form' ? 'เข้าร่วมบ้านแล้ว' : 'สร้างบ้านใหม่แล้ว'); }); };
}
$('rename-home-form').onsubmit = e => { e.preventDefault(); run(e.submitter, () => mutate('homes/rename', Object.fromEntries(new FormData(e.target)), 'บันทึกชื่อบ้านแล้ว')); };
$('copy-invite').onclick = () => run($('copy-invite'), async () => { try { await navigator.clipboard.writeText(state.user.invite); notice('คัดลอกรหัสเชิญแล้ว'); } catch { notice('คัดลอกอัตโนมัติไม่ได้ สามารถเลือกรหัสที่แสดงแล้วคัดลอกได้'); } });
$('rotate-invite').onclick = () => confirmAction('เปลี่ยนรหัสเชิญ?', 'รหัสเดิมจะใช้เข้าร่วมบ้านไม่ได้ สมาชิกปัจจุบันยังใช้งานได้ตามเดิม', () => mutate('homes/invite/rotate', {}, 'เปลี่ยนรหัสเชิญแล้ว'));
$('leave-home').onclick = () => confirmAction('ออกจากบ้านนี้?', 'คุณจะเข้าถึงข้อมูลบ้านนี้ไม่ได้จนกว่าจะเข้าร่วมใหม่ งานที่คุณรับและยังไม่เสร็จจะกลับไปรอผู้รับผิดชอบ ประวัติการดูแลจะยังอยู่', async () => { await api('homes/leave', {}); resetFilters(); view = 'board'; await load(); notice('ออกจากบ้านแล้ว'); });
function openPet(pet) {
  editingPet = pet?.id; $('pet-form').reset(); $('pet-dialog-title').textContent = pet ? 'แก้ไขข้อมูลสัตว์เลี้ยง' : 'เพิ่มสัตว์เลี้ยง';
  if (pet) for (const k of ['name', 'species', 'notes']) $('pet-form').elements[k].value = pet[k];
  openDialog('pet-dialog');
}
$('new-pet').onclick = () => openPet();
$('pet-form').onsubmit = e => { e.preventDefault(); run(e.submitter, async () => { await api(editingPet ? `pets/${editingPet}/edit` : 'pets', Object.fromEntries(new FormData(e.target))); $('pet-dialog').close(); await load(); notice('บันทึกข้อมูลสัตว์เลี้ยงแล้ว'); }); };
function openTask(task) {
  editingTask = task?.id; $('task-form').reset(); $('task-dialog-title').textContent = task ? 'แก้ไขงานดูแล' : 'เพิ่มงานดูแล';
  $('pet-select').disabled = Boolean(task);
  if (task) { for (const k of ['title', 'priority', 'recurrence']) $('task-form').elements[k].value = task[k]; $('pet-select').value = task.pet_id; $('task-form').elements.due.value = localInput(task.due); }
  else $('task-form').elements.due.value = localInput(Date.now() + 3600000);
  openDialog('task-dialog');
}
$('new-task').onclick = () => openTask();
$('task-form').onsubmit = e => { e.preventDefault(); run(e.submitter, async () => {
  const data = Object.fromEntries(new FormData(e.target)); data.pet_id = Number($('pet-select').value); data.due = new Date(data.due).toISOString();
  await api(editingTask ? `tasks/${editingTask}/edit` : 'tasks', data); $('task-dialog').close(); await load(); notice('บันทึกงานดูแลแล้ว');
}); };
$('complete-form').onsubmit = e => { e.preventDefault(); run(e.submitter, async () => { await api(`tasks/${completing}/complete`, Object.fromEntries(new FormData(e.target))); $('complete-dialog').close(); await load(); notice('บันทึกการดูแลเรียบร้อยแล้ว'); }); };
async function action(id, type) { try { await mutate(`tasks/${id}/${type}`, {}, type === 'claim' ? 'รับงานแล้ว' : 'คืนงานแล้ว'); } catch (e) { await load().catch(() => {}); throw e; } }
function renderTasks() {
  if (!state) return;
  const root = $('tasks'), q = $('search').value.trim().toLocaleLowerCase(), filter = $('filter').value, petId = $('pet-filter').value;
  root.replaceChildren();
  let tasks = state.tasks.filter(t => {
    const active = activeTask(t), cancelled = Boolean(t.cancelled_at), late = active && Date.parse(t.due) < Date.now();
    const matches = filter === 'all' || (filter === 'active' && active) || (filter === 'done' && t.status === 'done' && !cancelled) || (filter === 'cancelled' && cancelled) || (filter === 'overdue' && late) || (filter === 'mine' && active && t.assignee === state.user.id) || (filter === 'today' && active && new Date(t.due).toDateString() === new Date().toDateString());
    return matches && (petId === 'all' || String(t.pet_id) === petId) && [t.title, t.pet_name, t.assignee_name, t.note].some(v => (v || '').toLocaleLowerCase().includes(q));
  });
  tasks.sort((a, b) => ($('sort').value === 'priority' ? Number(b.priority === 'high') - Number(a.priority === 'high') : 0) || a.due.localeCompare(b.due) || a.id - b.id);
  $('task-summary').textContent = `${tasks.length} รายการในมุมมองนี้ · ${state.pets.filter(p => !p.archived).length} สัตว์เลี้ยง`;
  if (!tasks.length) root.append(el('div', state.tasks.length ? 'ไม่พบงานในมุมมองนี้ ลองเปลี่ยนตัวกรองหรือคำค้นหา' : 'ยังไม่มีงานดูแล เริ่มจากเพิ่มสัตว์เลี้ยง แล้วสร้างงานแรกของบ้าน', 'empty'));
  for (const t of tasks) {
    const card = el('article', undefined, 'task' + (t.priority === 'high' ? ' high' : '') + (t.cancelled_at ? ' cancelled' : ''));
    const info = el('div'), status = el('div'), actions = el('div', undefined, 'actions'), meta = el('div', undefined, 'task-meta');
    const late = activeTask(t) && Date.parse(t.due) < Date.now();
    info.append(el('h3', t.title), el('p', t.pet_name), el('p', date(t.due)));
    if (t.priority === 'high') meta.append(el('span', 'สำคัญ', 'badge'));
    if (t.recurrence !== 'none') meta.append(el('span', t.recurrence === 'daily' ? 'ทุกวัน' : 'ทุกสัปดาห์', 'badge'));
    info.append(meta);
    status.append(el('span', t.cancelled_at ? 'ยกเลิกแล้ว' : t.status === 'done' ? 'ทำแล้ว' : late ? 'เลยกำหนด' : t.status === 'claimed' ? 'มีผู้รับผิดชอบ' : 'รอคนรับงาน', 'badge' + (late || t.status === 'claimed' ? ' emphasis' : '')));
    status.append(el('p', t.assignee_name || 'ยังไม่มีผู้รับผิดชอบ'));
    if (t.completed_at) status.append(el('p', 'เสร็จ ' + date(t.completed_at)));
    if (t.note) info.append(el('p', 'บันทึก: ' + t.note));
    if (!t.cancelled_at && t.status === 'open') actions.append(button('รับงานนี้', () => action(t.id, 'claim'), 'primary'));
    if (!t.cancelled_at && t.status === 'claimed' && t.assignee === state.user.id) {
      actions.append(button('ทำแล้ว', () => { completing = t.id; $('complete-form').reset(); $('complete-title').textContent = t.title; openDialog('complete-dialog'); }, 'primary'));
      actions.append(button('คืนงาน', () => action(t.id, 'release')));
    }
    if (activeTask(t) && (isOwner() || t.created_by === state.user.id)) {
      if (t.status === 'open') actions.append(button('แก้ไข', () => openTask(t), 'text-button'));
      actions.append(button('ยกเลิก', () => confirmAction('ยกเลิกงานนี้?', `“${t.title}” จะหยุดการดูแลและไม่สร้างงานซ้ำครั้งถัดไป รายการจะยังอยู่ในประวัติ`, () => mutate(`tasks/${t.id}/cancel`, {}, 'ยกเลิกงานแล้ว')), 'text-button'));
    }
    const identity = el('div', undefined, 'task-identity');
    identity.append(portrait(state.pets.find(p => p.id === t.pet_id)?.species || ''), info);
    card.append(identity, status, actions); root.append(card);
  }
}
function renderPets() {
  $('pets').replaceChildren();
  if (!state.pets.length) $('pets').append(el('div', 'ยังไม่มีสัตว์เลี้ยง เพิ่มข้อมูลเพื่อเริ่มวางแผนดูแล', 'empty'));
  for (const p of state.pets) {
    const card = el('article', undefined, 'pet-card' + (p.archived ? ' archived' : ''));
    card.append(portrait(p.species, 'pet-avatar'), el('h3', p.name), el('p', p.species + (p.archived ? ' · เก็บประวัติแล้ว' : ''), 'muted'), el('p', p.notes || 'ยังไม่มีข้อควรทราบเพิ่มเติม', 'pet-notes'));
    const actions = el('div', undefined, 'actions');
    actions.append(button('แก้ไขข้อมูล', () => openPet(p), 'text-button'));
    if (isOwner()) actions.append(button(p.archived ? 'นำกลับมาดูแล' : 'เก็บประวัติ', () => confirmAction(p.archived ? 'นำกลับมาดูแล?' : 'เก็บประวัติสัตว์เลี้ยง?', p.archived ? 'สัตว์เลี้ยงจะกลับมาอยู่ในรายการสำหรับสร้างงานดูแล' : 'ข้อมูลและงานเก่าจะยังอยู่ แต่จะสร้างงานใหม่ให้ไม่ได้ ต้องไม่มีงานที่ค้างอยู่ก่อน', () => mutate(`pets/${p.id}/archive`, { archived: !p.archived }, 'อัปเดตสถานะสัตว์เลี้ยงแล้ว')), 'text-button'));
    card.append(actions); $('pets').append(card);
  }
}
function renderHousehold() {
  const owner = isOwner();
  $('home-role').textContent = owner ? 'คุณเป็นเจ้าของบ้าน' : 'คุณเป็นสมาชิกบ้านนี้';
  $('rename-home-form').hidden = !owner; $('rename-home-form').elements.name.value = state.user.home_name || '';
  $('invite-panel').hidden = !owner; $('member-invite-hint').hidden = owner; $('invite').textContent = state.user.invite || '';
  $('leave-home').disabled = owner; $('leave-hint').textContent = owner ? 'เจ้าของบ้านโอนสิทธิ์ให้สมาชิกอื่นก่อนออกจากบ้านได้' : 'ออกจากบ้านได้โดยไม่กระทบบัญชีหรือบ้านอื่น';
  $('member-count').textContent = `(${state.members.length})`; $('members').replaceChildren();
  for (const m of state.members) {
    const row = el('div', undefined, 'member'), info = el('div'), actions = el('div', undefined, 'actions');
    info.append(el('h4', m.name + (m.id === state.user.id ? ' (คุณ)' : '')), el('p', m.role === 'owner' ? 'เจ้าของบ้าน' : 'สมาชิก'));
    if (owner && m.id !== state.user.id) {
      actions.append(button('โอนสิทธิ์เจ้าของ', () => confirmAction('โอนสิทธิ์เจ้าของบ้าน?', `${m.name} จะเป็นเจ้าของบ้านแทนคุณ คุณจะเปลี่ยนเป็นสมาชิกและยังดูแลในบ้านได้`, () => mutate('homes/transfer', { user_id: m.id }, 'โอนสิทธิ์เจ้าของบ้านแล้ว')), 'text-button'));
      actions.append(button('นำออกจากบ้าน', () => confirmAction('นำสมาชิกออกจากบ้าน?', `${m.name} จะเข้าถึงบ้านนี้ไม่ได้ งานที่ค้างจะกลับไปรอผู้รับผิดชอบ สมาชิกยังเข้าร่วมใหม่ได้หากมีรหัสเชิญปัจจุบัน`, () => mutate('homes/members/remove', { user_id: m.id }, 'นำสมาชิกออกแล้ว')), 'text-button'));
    }
    row.append(info, actions); $('members').append(row);
  }
}
function renderHistory() {
  $('events').replaceChildren();
  const labels = { created: 'เพิ่มงาน', claim: 'รับงาน', complete: 'ทำเสร็จ', release: 'คืนงาน', edit: 'แก้ไขงาน', cancel: 'ยกเลิกงาน', member_release: 'คืนงานหลังเปลี่ยนสมาชิก' };
  for (const event of state.events) { const row = el('div', undefined, 'event'); row.append(el('span', `${event.actor_name} ${labels[event.action] || event.action} “${event.title}” ให้ ${event.pet_name}`), el('time', date(event.at))); $('events').append(row); }
  if (!state.events.length) $('events').append(el('p', 'ยังไม่มีกิจกรรมการดูแลในบ้านนี้', 'empty'));
}
async function load() {
  const previousHome = state?.user.home_id;
  state = await api('dashboard'); $('auth').hidden = true; $('dashboard').hidden = false;
  if (previousHome && previousHome !== state.user.home_id) resetFilters();
  $('today').textContent = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('home-title').textContent = state.user.home_name || 'บ้านของคุณ';
  $('greeting').textContent = `สวัสดี ${state.user.name} ดูแลงานของบ้านนี้ได้จากที่เดียว`;
  $('account').replaceChildren(el('span', state.user.name), button('ออกจากระบบ', async () => { await api('logout', {}); showAuth(); }, 'secondary'));
  $('home-switch').replaceChildren();
  for (const h of state.homes) { const opt = el('option', h.name); opt.value = h.id; $('home-switch').append(opt); }
  if (!state.homes.length) $('home-switch').append(el('option', 'ยังไม่มีบ้าน'));
  $('home-switch').value = state.user.home_id || ''; $('home-switch').disabled = !state.homes.length;
  $('sidebar-members').textContent = `${state.members.length} สมาชิกในบ้านนี้`;
  $('no-home').hidden = Boolean(state.user.home_id); $('home-content').hidden = !state.user.home_id;
  $('pending-count').textContent = String(state.tasks.filter(activeTask).length).padStart(2, '0');
  $('overdue-count').textContent = String(state.tasks.filter(t => activeTask(t) && Date.parse(t.due) < Date.now()).length).padStart(2, '0');
  $('done-count').textContent = String(state.tasks.filter(t => t.status === 'done' && !t.cancelled_at).length).padStart(2, '0');
  const oldPetFilter = $('pet-filter').value;
  $('pet-filter').replaceChildren(); const all = el('option', 'ทุกตัว'); all.value = 'all'; $('pet-filter').append(all);
  $('pet-select').replaceChildren();
  for (const p of state.pets) {
    const filter = el('option', p.name + (p.archived ? ' (เก็บประวัติ)' : '')); filter.value = p.id; $('pet-filter').append(filter);
    if (!p.archived) { const option = el('option', p.name); option.value = p.id; $('pet-select').append(option); }
  }
  if (state.pets.some(p => String(p.id) === oldPetFilter)) $('pet-filter').value = oldPetFilter;
  $('new-task').disabled = !state.pets.some(p => !p.archived);
  renderTasks(); renderPets(); renderHousehold(); renderHistory(); showView(view);
}
load().catch(e => { showAuth(); if (e.message !== 'กรุณาเข้าสู่ระบบ') notice(e.message); });
// Refresh only when no form dialog is open; never interrupt an in-progress edit.
setInterval(() => { if (state && !document.hidden && !document.querySelector('dialog[open]')) load().catch(e => notice(e.message)); }, 30000);
