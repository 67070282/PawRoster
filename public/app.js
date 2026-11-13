const $ = id => document.getElementById(id);
let mode = 'login', state, view = 'board', editingPet, editingTask, completing, deletingPet, editingRecord, assigning;
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1), calendarDay = dayKey(new Date());
function notice(message = '') { $('notice').textContent = message; $('notice').hidden = !message; }
function el(tag, text, className) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e; }
function date(value) { return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); }
function localInput(value) { const d = new Date(value); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
const activeTask = t => t.status !== 'done' && !t.cancelled_at;
const isOwner = () => state?.user.role === 'owner';
const recordLabels = { weight: 'น้ำหนัก', vaccine: 'วัคซีน', visit: 'พบสัตวแพทย์', note: 'บันทึกทั่วไป' };
function dayKey(value) { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
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
function resetFilters() { $('filter').value = 'active'; $('pet-filter').value = 'all'; $('search').value = ''; $('sort').value = 'due'; $('pet-status').value = 'active'; $('journal-pet').value = 'all'; $('journal-search').value = ''; $('journal-kind').value = 'all'; $('calendar-pet').value = 'all'; }
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
  if (pet) for (const k of ['name', 'species', 'notes', 'breed', 'birth_date', 'sex']) $('pet-form').elements[k].value = pet[k] || (k === 'sex' ? 'unknown' : '');
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
  $('task-summary').textContent = `${tasks.length} รายการในมุมมองนี้ · ${state.pets.filter(p => !p.archived && !p.deleted_at).length} สัตว์เลี้ยง`;
  if (!tasks.length) {
    const empty = el('div', state.tasks.length ? 'ไม่พบงานตามตัวกรองนี้ ลองเลือก “งานทั้งหมด” หรือล้างคำค้นหา' : 'ยังไม่มีงานดูแลในบ้านนี้', 'empty');
    if (!state.pets.some(p => !p.archived && !p.deleted_at)) {
      empty.append(el('p', 'เพิ่มสัตว์เลี้ยงก่อน แล้วจึงสร้างงานดูแลได้'), button('เพิ่มสัตว์เลี้ยง', () => openPet(), 'primary'));
    } else if (!state.tasks.length) empty.append(button('เพิ่มงานดูแล', () => openTask(), 'primary'));
    root.append(empty);
  }
  for (const t of tasks) {
    const card = el('article', undefined, 'task' + (t.priority === 'high' ? ' high' : '') + (t.cancelled_at ? ' cancelled' : ''));
    const info = el('div'), status = el('div'), actions = el('div', undefined, 'actions'), meta = el('div', undefined, 'task-meta');
    const late = activeTask(t) && Date.parse(t.due) < Date.now();
    info.append(el('h3', t.title), el('p', t.pet_name), el('p', date(t.due)));
    if (t.priority === 'high') meta.append(el('span', 'สำคัญ', 'badge'));
    if (t.recurrence !== 'none') meta.append(el('span', t.recurrence === 'daily' ? 'ทุกวัน' : 'ทุกสัปดาห์', 'badge'));
    info.append(meta);
    const statusKey = t.cancelled_at ? 'cancelled' : t.status === 'done' ? 'done' : late ? 'overdue' : t.status === 'claimed' ? 'claimed' : 'open';
    const statusText = { cancelled:'ยกเลิกแล้ว', done:'ทำเสร็จแล้ว', overdue:'เลยกำหนด', claimed:'กำลังดูแล', open:'รอผู้ดูแล' };
    status.append(el('span', statusText[statusKey], 'badge status-' + statusKey));
    status.append(el('p', t.assignee_name || 'ยังไม่มีผู้รับผิดชอบ'));
    if (t.completed_at) status.append(el('p', 'เสร็จ ' + date(t.completed_at)));
    if (t.note) info.append(el('p', 'บันทึก: ' + t.note));
    if (!t.cancelled_at && !t.pet_deleted_at && t.status === 'open') {
      actions.append(button('รับงานนี้', () => action(t.id, 'claim'), 'primary'));
      if (isOwner()) actions.append(button('มอบหมาย', () => openAssignment(t), 'secondary'));
    }
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
  $('pet-permission').textContent = isOwner() ? 'คุณเป็นเจ้าของบ้าน: แก้ไขข้อมูล ย้ายไปถังขยะ และกู้คืนสัตว์เลี้ยงได้' : 'คุณเป็นสมาชิก: เพิ่มและแก้ไขข้อมูลได้ หากต้องการลบหรือกู้คืนสัตว์เลี้ยง ให้เจ้าของบ้านจัดการ';
  const status = $('pet-status').value;
  const pets = state.pets.filter(p => status === 'deleted' ? p.deleted_at : !p.deleted_at && (status === 'all' || (status === 'archived' ? p.archived : !p.archived)));
  if (!pets.length) $('pets').append(el('div', status === 'deleted' ? 'ถังขยะว่าง สัตว์เลี้ยงที่ลบจะอยู่ที่นี่และเจ้าของบ้านกู้คืนได้' : 'ไม่มีสัตว์เลี้ยงในมุมมองนี้ เพิ่มข้อมูลใหม่หรือเปลี่ยนตัวกรองได้', 'empty'));
  for (const p of pets) {
    const card = el('article', undefined, 'pet-card' + (p.archived ? ' archived' : ''));
    card.append(portrait(p.species, 'pet-avatar'), el('h3', p.name), el('p', p.species + (p.archived ? ' · เก็บประวัติแล้ว' : ''), 'muted'), el('p', p.notes || 'ยังไม่มีข้อควรทราบเพิ่มเติม', 'pet-notes'));
    const profile = [p.breed, p.sex === 'male' ? 'เพศผู้' : p.sex === 'female' ? 'เพศเมีย' : '', p.birth_date ? 'เกิด ' + new Date(p.birth_date + 'T12:00:00').toLocaleDateString('th-TH') : ''].filter(Boolean);
    if (profile.length) card.append(el('p', profile.join(' · '), 'hint'));
    const actions = el('div', undefined, 'actions');
    if (p.deleted_at) {
      card.append(el('p', 'อยู่ในถังขยะตั้งแต่ ' + date(p.deleted_at), 'hint'));
      if (isOwner()) actions.append(button('กู้คืนสัตว์เลี้ยง', () => confirmAction('กู้คืนสัตว์เลี้ยง?', 'ข้อมูลและสมุดบันทึกจะกลับมา งานที่ยกเลิกตอนลบจะไม่เปิดกลับอัตโนมัติ', () => mutate(`pets/${p.id}/restore`, {}, 'กู้คืนสัตว์เลี้ยงแล้ว'))));
    } else {
      actions.append(button('สมุดบันทึก', () => { $('journal-pet').value = p.id; renderJournal(); showView('journal'); }, 'primary'));
      actions.append(button('แก้ไขข้อมูล', () => openPet(p), 'text-button'));
      if (isOwner()) {
        actions.append(button(p.archived ? 'นำกลับมาดูแล' : 'เก็บประวัติ', () => confirmAction(p.archived ? 'นำกลับมาดูแล?' : 'เก็บประวัติสัตว์เลี้ยง?', p.archived ? 'สัตว์เลี้ยงจะกลับมาอยู่ในรายการสำหรับสร้างงานดูแล' : 'ข้อมูลและงานเก่าจะยังอยู่ แต่จะสร้างงานใหม่ให้ไม่ได้ ต้องไม่มีงานที่ค้างอยู่ก่อน', () => mutate(`pets/${p.id}/archive`, { archived: !p.archived }, 'อัปเดตสถานะสัตว์เลี้ยงแล้ว')), 'text-button'));
        actions.append(button('ลบสัตว์เลี้ยง', () => { deletingPet = p.id; $('delete-pet-form').reset(); $('delete-pet-description').textContent = `ย้าย “${p.name}” ไปถังขยะและยกเลิกงานค้างของสัตว์เลี้ยงตัวนี้ ประวัติและสมุดบันทึกยังเก็บไว้ เจ้าของบ้านกู้คืนได้`; openDialog('delete-pet-dialog'); }, 'text-button danger'));
      }
    }
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
  const labels = { created: 'เพิ่มงาน', claim: 'รับงาน', complete: 'ทำเสร็จ', release: 'คืนงาน', edit: 'แก้ไขงาน', cancel: 'ยกเลิกงาน', member_release: 'คืนงานหลังเปลี่ยนสมาชิก', assign: 'มอบหมายงาน', pet_delete: 'ยกเลิกงานเนื่องจากลบสัตว์เลี้ยง' };
  for (const event of state.events) { const row = el('div', undefined, 'event'); row.append(el('span', `${event.actor_name} ${labels[event.action] || event.action} “${event.title}” ให้ ${event.pet_name}${event.action === 'assign' ? ' ผู้รับผิดชอบ: ' + event.detail : ''}`), el('time', date(event.at))); $('events').append(row); }
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
    if (!p.archived && !p.deleted_at) { const option = el('option', p.name); option.value = p.id; $('pet-select').append(option); }
  }
  if (state.pets.some(p => String(p.id) === oldPetFilter)) $('pet-filter').value = oldPetFilter;
  $('new-task').disabled = !state.pets.some(p => !p.archived && !p.deleted_at);
  fillPetChoices('journal-pet', true); fillPetChoices('record-pet', false); fillPetChoices('calendar-pet', true);
  $('new-record').disabled = !state.pets.some(p => !p.deleted_at);
  $('calendar-add').disabled = $('new-task').disabled;
  renderTasks(); renderPets(); renderHousehold(); renderHistory(); renderJournal(); renderCalendar(); showView(view);
}
load().catch(e => { showAuth(); if (e.message !== 'กรุณาเข้าสู่ระบบ') notice(e.message); });
// Refresh only when no form dialog is open; never interrupt an in-progress edit.
setInterval(() => { if (state && !document.hidden && !document.querySelector('dialog[open]') && !document.activeElement?.matches('input,textarea,select') && $('rename-home-form').elements.name.value === (state.user.home_name || '')) load().catch(e => notice(e.message)); }, 30000);

$('pet-status').onchange = renderPets;
$('delete-pet-form').onsubmit = e => { e.preventDefault(); run(e.submitter, async () => { await api(`pets/${deletingPet}/delete`, Object.fromEntries(new FormData(e.target))); $('delete-pet-dialog').close(); $('pet-status').value = 'deleted'; await load(); notice('ย้ายสัตว์เลี้ยงไปถังขยะแล้ว กู้คืนได้จากมุมมองถังขยะ'); }); };
function fillPetChoices(id, all) {
  const select = $(id), previous = select.value; select.replaceChildren();
  if (all) { const option = el('option', 'ทุกตัว'); option.value = 'all'; select.append(option); }
  for (const p of state.pets.filter(p => !p.deleted_at)) { const option = el('option', p.name + (p.archived ? ' (เก็บประวัติ)' : '')); option.value = p.id; select.append(option); }
  if ([...select.options].some(o => o.value === previous)) select.value = previous;
}
function openAssignment(task) {
  assigning = task.id; $('assign-title').textContent = task.title; $('assign-member').replaceChildren();
  for (const m of state.members) { const option = el('option', m.name); option.value = m.id; $('assign-member').append(option); }
  openDialog('assign-dialog');
}
$('assign-form').onsubmit = e => { e.preventDefault(); run(e.submitter, async () => { await api(`tasks/${assigning}/assign`, { user_id: Number($('assign-member').value) }); $('assign-dialog').close(); await load(); notice('มอบหมายงานแล้ว'); }); };
function recordKindFields() {
  const kind = $('record-kind').value; $('weight-field').hidden = kind !== 'weight'; $('record-form').elements.weight_kg.required = kind === 'weight';
  $('appointment-field').hidden = !['vaccine', 'visit'].includes(kind);
}
function openRecord(record) {
  editingRecord = record?.id; $('record-form').reset(); $('record-dialog-title').textContent = record ? 'แก้ไขบันทึก' : 'เพิ่มบันทึก'; $('record-pet').disabled = Boolean(record);
  if (record) {
    for (const k of ['kind', 'title', 'notes']) $('record-form').elements[k].value = record[k];
    $('record-pet').value = record.pet_id; $('record-form').elements.recorded_at.value = localInput(record.recorded_at);
    $('record-form').elements.weight_kg.value = record.weight_kg ?? ''; $('record-form').elements.due_at.value = record.due_at ? localInput(record.due_at) : '';
  } else {
    if ($('journal-pet').value !== 'all') $('record-pet').value = $('journal-pet').value;
    $('record-form').elements.recorded_at.value = localInput(Date.now());
  }
  recordKindFields(); openDialog('record-dialog');
}
$('record-kind').onchange = recordKindFields; $('new-record').onclick = () => openRecord();
$('record-form').onsubmit = e => { e.preventDefault(); run(e.submitter, async () => {
  const data = Object.fromEntries(new FormData(e.target)); data.pet_id = Number($('record-pet').value); data.recorded_at = new Date(data.recorded_at).toISOString();
  data.weight_kg = data.kind === 'weight' ? Number(data.weight_kg) : null;
  data.due_at = ['vaccine', 'visit'].includes(data.kind) && data.due_at ? new Date(data.due_at).toISOString() : null;
  await api(editingRecord ? `records/${editingRecord}/edit` : 'records', data); $('record-dialog').close(); await load(); notice('บันทึกข้อมูลแล้ว');
}); };
function visibleRecords() {
  const petId = $('journal-pet').value, kind = $('journal-kind').value, q = $('journal-search').value.toLocaleLowerCase().trim();
  return (state.records || []).filter(r => !r.pet_deleted_at && (petId === 'all' || String(r.pet_id) === petId) && (kind === 'all' || r.kind === kind) && [r.title, r.notes, r.pet_name].some(v => (v || '').toLocaleLowerCase().includes(q)));
}
function renderJournal() {
  if (!state) return; const root = $('records'); root.replaceChildren(); const records = visibleRecords();
  $('journal-summary').textContent = `แสดง ${records.length} บันทึก · เลือกสัตว์เลี้ยงเพื่อดูน้ำหนักล่าสุดและประวัติ`;
  if (!records.length) root.append(el('div', 'ยังไม่มีบันทึกตามตัวกรองนี้ เลือก “เพิ่มบันทึก” เพื่อเริ่มจดข้อมูล หรือลองเปลี่ยนตัวกรอง', 'empty'));
  for (const r of records) {
    const card = el('article', undefined, 'record-card'), header = el('div', undefined, 'record-heading'), meta = el('div');
    meta.append(el('span', recordLabels[r.kind], 'badge'), el('h3', r.title), el('p', r.pet_name + ' · ' + date(r.recorded_at), 'muted'));
    header.append(meta); if (r.kind === 'weight') header.append(el('strong', `${r.weight_kg} กก.`, 'record-value'));
    card.append(header); if (r.notes) card.append(el('p', r.notes, 'record-note'));
    if (r.due_at) card.append(el('p', `${r.resolved_at ? 'นัดหมายเสร็จแล้ว' : 'นัดหมาย'}: ${date(r.due_at)}`, 'appointment-note'));
    card.append(el('p', 'บันทึกโดย ' + r.author_name, 'hint'));
    if (isOwner() || r.created_by === state.user.id) {
      const actions = el('div', undefined, 'actions');
      if (r.due_at) actions.append(button(r.resolved_at ? 'เปิดนัดหมายอีกครั้ง' : 'นัดหมายเสร็จแล้ว', () => mutate(`records/${r.id}/resolve`, { resolved: !r.resolved_at }, 'อัปเดตสถานะนัดหมายแล้ว')));
      actions.append(button('แก้ไขบันทึก', () => openRecord(r), 'text-button'));
      actions.append(button('ลบบันทึก', () => confirmAction('ลบบันทึกนี้ถาวร?', `“${r.title}” จะถูกลบจากสมุดบันทึกและปฏิทิน รายการนี้กู้คืนผ่านหน้าเว็บไม่ได้`, () => mutate(`records/${r.id}/delete`, {}, 'ลบบันทึกแล้ว')), 'text-button danger'));
      card.append(actions);
    }
    root.append(card);
  }
  $('weight-summary').replaceChildren();
  const selected = $('journal-pet').value;
  if (selected !== 'all') {
    const weights = (state.records || []).filter(r => !r.pet_deleted_at && String(r.pet_id) === selected && r.kind === 'weight').sort((a,b) => a.recorded_at.localeCompare(b.recorded_at) || a.id-b.id);
    if (weights.length) {
      const panel = el('section', undefined, 'weight-panel'), latest = weights.at(-1);
      panel.append(el('h3', `น้ำหนักล่าสุด ${latest.weight_kg} กก.`), el('p', date(latest.recorded_at), 'hint'));
      if (weights.length > 1) { const difference = Math.round((latest.weight_kg - weights.at(-2).weight_kg) * 1000) / 1000; panel.append(el('p', `ต่างจากบันทึกก่อนหน้า ${difference > 0 ? '+' : ''}${difference} กก.`, 'muted')); }
      const chart = el('div', undefined, 'weight-chart'); chart.setAttribute('aria-label', 'ประวัติน้ำหนักสูงสุด 6 บันทึกล่าสุด');
      for (const w of weights.slice(-6)) { const column = el('div'); column.append(el('strong', w.weight_kg + ' กก.'), el('span', new Date(w.recorded_at).toLocaleDateString('th-TH', { day:'numeric',month:'short' }))); chart.append(column); }
      panel.append(chart); $('weight-summary').append(panel);
    }
  }
  $('export-records').disabled = !records.length;
}
for (const id of ['journal-pet', 'journal-kind']) $(id).onchange = renderJournal;
$('journal-search').oninput = renderJournal;
$('export-records').onclick = () => {
  const cell = value => { let s = String(value ?? ''); if (/^[\s]*[=+@-]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
  const rows = [['สัตว์เลี้ยง','ประเภท','หัวข้อ','วันที่บันทึก (UTC)','น้ำหนัก (กก.)','นัดหมาย (UTC)','สถานะนัดหมาย','หมายเหตุ'], ...visibleRecords().map(r => [r.pet_name,recordLabels[r.kind],r.title,r.recorded_at,r.weight_kg,r.due_at,r.due_at ? (r.resolved_at ? 'เสร็จแล้ว' : 'ยังไม่เสร็จ') : '',r.notes])];
  const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type:'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'pawroster-journal.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function calendarItems() {
  const petId = $('calendar-pet').value, all = $('calendar-status').value === 'all';
  const tasks = state.tasks.filter(t => !t.pet_deleted_at && !t.cancelled_at && (all || activeTask(t))).map(t => ({ id:t.id,type:'task',pet_id:t.pet_id,title:t.title,pet_name:t.pet_name,at:t.due,done:t.status==='done',source:t }));
  const appointments = (state.records || []).filter(r => !r.pet_deleted_at && r.due_at && (all || !r.resolved_at)).map(r => ({ id:r.id,type:'appointment',pet_id:r.pet_id,title:r.title,pet_name:r.pet_name,at:r.due_at,done:Boolean(r.resolved_at),source:r }));
  return [...tasks,...appointments].filter(i => petId === 'all' || String(i.pet_id) === petId).sort((a,b) => a.at.localeCompare(b.at));
}
function renderCalendar() {
  if (!state) return; const root = $('calendar-grid'); root.replaceChildren(); const items = calendarItems();
  $('calendar-month').textContent = calendarMonth.toLocaleDateString('th-TH', { month:'long',year:'numeric' });
  for (const label of ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.']) root.append(el('span', label, 'calendar-weekday'));
  const start = new Date(calendarMonth); start.setDate(1 - (start.getDay()+6)%7);
  for (let n=0;n<42;n++) {
    const d = new Date(start); d.setDate(start.getDate()+n); const key = dayKey(d), events = items.filter(i => dayKey(i.at) === key);
    const b = document.createElement('button'); b.type='button'; b.className='calendar-cell' + (d.getMonth()!==calendarMonth.getMonth()?' outside':'') + (key===calendarDay?' selected':'') + (key===dayKey(new Date())?' today':'');
    b.setAttribute('aria-label', `${d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})} ${events.length} รายการ`); b.setAttribute('aria-pressed', String(key===calendarDay));
    b.append(el('strong', d.getDate()));
    if (events.length) { b.append(el('span', `${events.length} รายการ`, 'calendar-count')); if (events.some(i=>i.type==='appointment')) b.append(el('small','มีนัดหมาย')); }
    b.onclick=()=>{ calendarDay=key; calendarMonth=new Date(d.getFullYear(),d.getMonth(),1); renderCalendar(); }; root.append(b);
  }
  const selected = new Date(calendarDay+'T12:00:00'); $('calendar-day-title').textContent = selected.toLocaleDateString('th-TH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('calendar-agenda').replaceChildren(); const dayItems=items.filter(i=>dayKey(i.at)===calendarDay);
  if (!dayItems.length) $('calendar-agenda').append(el('p','ไม่มีงานหรือนัดหมายในวันที่เลือก','empty'));
  for (const item of dayItems) {
    const row=el('article',undefined,'agenda-item'), info=el('div'); info.append(el('span',item.type==='task'?'งานดูแล':'นัดหมาย','badge'),el('h3',item.title),el('p',`${item.pet_name} · ${date(item.at)}${item.done?' · เสร็จแล้ว':''}`,'muted'));
    row.append(info,button(item.type==='task'?'ดูงานดูแล':'ดูบันทึกนัดหมาย',()=>{ if(item.type==='task'){ $('search').value=item.title; $('filter').value='all'; $('pet-filter').value=String(item.pet_id); renderTasks(); showView('board'); } else { $('journal-pet').value=item.pet_id; $('journal-kind').value='all'; $('journal-search').value=''; renderJournal(); showView('journal'); } })); $('calendar-agenda').append(row);
  }
}
$('calendar-prev').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);calendarDay=dayKey(calendarMonth);renderCalendar();};
$('calendar-next').onclick=()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);calendarDay=dayKey(calendarMonth);renderCalendar();};
$('calendar-today').onclick=()=>{calendarDay=dayKey(new Date());calendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderCalendar();};
for (const id of ['calendar-pet','calendar-status']) $(id).onchange=renderCalendar;
$('calendar-add').onclick=()=>{openTask();$('task-form').elements.due.value=calendarDay+'T09:00';};
