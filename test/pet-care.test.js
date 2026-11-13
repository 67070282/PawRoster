import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createApp } from '../src/server.js';

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pawroster-care-')), path = join(dir, 'care.db');
  let app = createApp({ dbPath:path }), url;
  async function start() { await new Promise(r=>app.server.listen(0,'127.0.0.1',r)); url=`http://127.0.0.1:${app.server.address().port}`; }
  await start();
  t.after(async()=>{ await new Promise(r=>app.server.close(r)); app.db.close(); rmSync(dir,{recursive:true,force:true}); });
  function client() { let cookie=''; return async (endpoint,data,status=200,headers={})=>{
    const response=await fetch(url+'/api/'+endpoint,{method:data===undefined?'GET':'POST',headers:{Cookie:cookie,...headers,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});
    if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];
    const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;
  }; }
  const owner=client(),member=client(),outsider=client();
  await owner('register',{name:'Owner',home:'Care home',email:'owner@example.com',password:'test-password-123'},201);
  const initial=await owner('dashboard');
  await member('register',{name:'Member',invite:initial.user.invite,email:'member@example.com',password:'test-password-123'},201);
  await outsider('register',{name:'Other',home:'Other home',email:'other@example.com',password:'test-password-123'},201);
  const pet=await owner('pets',{name:'Mochi',species:'cat',breed:'Mixed',birth_date:'2020-01-01',sex:'female'},201);
  return {owner,member,outsider,pet,restart:async()=>{await new Promise(r=>app.server.close(r));app.db.close();app=createApp({dbPath:path});await start();}};
}
const instant='2026-11-13T09:00:00.000Z';
const weight=(pet_id,extra={})=>({pet_id,kind:'weight',title:'Weight',recorded_at:instant,weight_kg:4.25,notes:'Synthetic test',...extra});

test('C1 delete moves a pet to recoverable trash, cancels active work and retains audit/records',async t=>{
  const {owner,member,outsider,pet,restart}=await fixture(t);
  const completed=await owner('tasks',{pet_id:pet.id,title:'Old care',due:instant},201);
  await owner(`tasks/${completed.id}/claim`,{}); await owner(`tasks/${completed.id}/complete`,{note:'Retain this'});
  const open=await owner('tasks',{pet_id:pet.id,title:'Daily care',due:instant,recurrence:'daily'},201);
  await member(`tasks/${open.id}/claim`,{});const record=await owner('records',weight(pet.id),201);
  await member(`pets/${pet.id}/delete`,{confirm_name:'Mochi'},403);await outsider(`pets/${pet.id}/delete`,{confirm_name:'Mochi'},404);
  await owner(`pets/${pet.id}/delete`,{confirm_name:'wrong'},400);assert.equal((await owner('dashboard')).pets[0].deleted_at,null);
  await owner(`pets/${pet.id}/delete`,{confirm_name:'Mochi'});
  let state=await owner('dashboard');assert.ok(state.pets[0].deleted_at);assert.equal(state.records[0].id,record.id);assert.equal(state.tasks.find(x=>x.id===completed.id).note,'Retain this');
  assert.ok(state.tasks.find(x=>x.id===open.id).cancelled_at);assert.equal(state.events.filter(x=>x.action==='pet_delete').length,1);
  await owner(`pets/${pet.id}/delete`,{confirm_name:'Mochi'},409);await member(`tasks/${open.id}/complete`,{},404);
  await owner('records',weight(pet.id),404);await owner(`records/${record.id}/edit`,weight(pet.id),409);
  await restart();assert.ok((await owner('dashboard')).pets[0].deleted_at);
  await member(`pets/${pet.id}/restore`,{},403);await owner(`pets/${pet.id}/restore`,{});
  state=await owner('dashboard');assert.equal(state.pets[0].deleted_at,null);assert.equal(state.pets[0].archived,0);assert.ok(state.tasks.find(x=>x.id===open.id).cancelled_at);assert.equal(state.tasks.length,2);assert.equal(state.records.length,1);
});

test('C2 pet profile validates real dates, sex, length and retains optional fields',async t=>{
  const {owner,pet}=await fixture(t);let p=(await owner('dashboard')).pets[0];assert.equal(p.breed,'Mixed');assert.equal(p.sex,'female');
  await owner(`pets/${pet.id}/edit`,{name:'Mochi',species:'cat',birth_date:'2026-02-31'},400);
  await owner(`pets/${pet.id}/edit`,{name:'Mochi',species:'cat',birth_date:'2999-01-01'},400);
  await owner(`pets/${pet.id}/edit`,{name:'Mochi',species:'cat',sex:'other'},400);
  await owner(`pets/${pet.id}/edit`,{name:'Mochi',species:'cat',breed:'x'.repeat(61)},400);
  await owner(`pets/${pet.id}/edit`,{name:'Mochi',species:'cat',breed:'Domestic',birth_date:'2024-02-29',sex:'male'});
  p=(await owner('dashboard')).pets[0];assert.equal(p.birth_date,'2024-02-29');assert.equal(p.breed,'Domestic');
});

test('C3 journal creation and editing enforce household, author and owner permissions',async t=>{
  const {owner,member,outsider,pet}=await fixture(t);
  const r=await member('records',weight(pet.id,{notes:'<script>literal text</script>'}),201);
  await outsider('records',weight(pet.id),404);assert.equal((await outsider('dashboard')).records.length,0);
  await outsider(`records/${r.id}/edit`,weight(pet.id),404);await outsider(`records/${r.id}/delete`,{},404);
  await owner(`records/${r.id}/edit`,weight(pet.id,{weight_kg:4.5}));assert.equal((await member('dashboard')).records[0].weight_kg,4.5);
  const own=await owner('records',{pet_id:pet.id,kind:'note',title:'Care note',recorded_at:instant,notes:'Data'},201);
  await member(`records/${own.id}/edit`,weight(pet.id),403);await member(`records/${own.id}/delete`,{},403);
  await member(`records/${r.id}/delete`,{});assert.equal((await owner('dashboard')).records.length,1);
});

test('C4 journal validates numeric weight, dates, notes and appointment kinds',async t=>{
  const {owner,pet}=await fixture(t);
  for(const value of [0,-1,2001,'4.5',null])await owner('records',weight(pet.id,{weight_kg:value}),400);
  await owner('records',weight(pet.id,{recorded_at:'2026-02-31T09:00:00.000Z'}),400);
  await owner('records',weight(pet.id,{due_at:instant}),400);await owner('records',weight(pet.id,{kind:'medication'}),400);
  await owner('records',weight(pet.id,{notes:'x'.repeat(1001)}),400);await owner('records',weight(pet.id,{title:''}),400);
  await owner('records',weight(pet.id,{weight_kg:0.001}),201);
  await owner('records',{pet_id:pet.id,kind:'note',title:'Literal SQL',recorded_at:instant,notes:"Robert'); DROP TABLE users;--"},201);
  assert.equal((await owner('dashboard')).records.length,2);
});

test('C5 appointments resolve/reopen, reset on rescheduling and persist after restart',async t=>{
  const {owner,member,pet,restart}=await fixture(t);
  const fields={pet_id:pet.id,kind:'vaccine',title:'Vaccine record',recorded_at:instant,due_at:'2026-12-01T03:00:00.000Z',notes:'Entered by owner'};
  const r=await owner('records',fields,201);await member(`records/${r.id}/resolve`,{resolved:true},403);
  await owner(`records/${r.id}/resolve`,{resolved:true});await restart();let saved=(await owner('dashboard')).records[0];assert.ok(saved.resolved_at);
  await owner(`records/${r.id}/resolve`,{resolved:false});assert.equal((await owner('dashboard')).records[0].resolved_at,null);
  await owner(`records/${r.id}/resolve`,{resolved:true});await owner(`records/${r.id}/edit`,{...fields,due_at:'2026-12-02T03:00:00.000Z'});assert.equal((await owner('dashboard')).records[0].resolved_at,null);
  const n=await owner('records',weight(pet.id),201);await owner(`records/${n.id}/resolve`,{resolved:true},400);
});

test('C6 owner assignment uses current membership, assignee-only completion and one audit',async t=>{
  const {owner,member,outsider,pet}=await fixture(t), due=instant;
  const task=await owner('tasks',{pet_id:pet.id,title:'Assign care',due},201), memberId=(await member('dashboard')).user.id;
  await member(`tasks/${task.id}/assign`,{user_id:memberId},403);
  await owner(`tasks/${task.id}/assign`,{user_id:(await outsider('dashboard')).user.id},400);
  await owner(`tasks/${task.id}/assign`,{user_id:memberId});await owner(`tasks/${task.id}/assign`,{user_id:memberId},409);
  await owner(`tasks/${task.id}/complete`,{},403);await member(`tasks/${task.id}/complete`,{note:'Assigned work completed'});
  const saved=await owner('dashboard');assert.equal(saved.events.filter(e=>e.action==='assign').length,1);assert.equal(saved.events.find(e=>e.action==='assign').detail,'Member');
});

test('C7 v2 database migrates to v3 without losing sessions, archived pets or task history',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'pawroster-schema2-')),path=join(dir,'v2.db');const db=new DatabaseSync(path);
  db.exec(`CREATE TABLE homes(id INTEGER PRIMARY KEY,name TEXT NOT NULL,invite TEXT NOT NULL UNIQUE);
    CREATE TABLE users(id INTEGER PRIMARY KEY,home_id INTEGER NOT NULL REFERENCES homes(id),name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,password TEXT NOT NULL);
    CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL,active_home_id INTEGER REFERENCES homes(id));
    CREATE TABLE memberships(home_id INTEGER NOT NULL REFERENCES homes(id),user_id INTEGER NOT NULL REFERENCES users(id),role TEXT NOT NULL,PRIMARY KEY(home_id,user_id));
    CREATE TABLE pets(id INTEGER PRIMARY KEY,home_id INTEGER NOT NULL REFERENCES homes(id),name TEXT NOT NULL,species TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',archived INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE tasks(id INTEGER PRIMARY KEY,pet_id INTEGER NOT NULL REFERENCES pets(id),title TEXT NOT NULL,due TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',assignee INTEGER REFERENCES users(id),completed_at TEXT,note TEXT NOT NULL DEFAULT '',created_by INTEGER REFERENCES users(id),priority TEXT NOT NULL DEFAULT 'normal',recurrence TEXT NOT NULL DEFAULT 'none',cancelled_at TEXT);
    CREATE TABLE events(id INTEGER PRIMARY KEY,task_id INTEGER NOT NULL REFERENCES tasks(id),actor INTEGER NOT NULL REFERENCES users(id),action TEXT NOT NULL,at TEXT NOT NULL);
    INSERT INTO homes VALUES(1,'Old home','invite');INSERT INTO users VALUES(1,1,'Owner','old@example.com','salt','hash');INSERT INTO memberships VALUES(1,1,'owner');INSERT INTO pets VALUES(1,1,'Old pet','cat','Keep notes',1);
    INSERT INTO tasks VALUES(1,1,'Old done','2026-11-01T00:00:00.000Z','done',1,'2026-11-01T00:01:00.000Z','Keep note',1,'high','none',NULL);
    INSERT INTO events VALUES(1,1,1,'complete','2026-11-01T00:01:00.000Z');PRAGMA user_version=2;`);
  const cookie='a'.repeat(48);db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(createHash('sha256').update(cookie).digest('hex'),1,Date.now()+3600000,1);db.close();
  const app=createApp({dbPath:path});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>app.server.close(r));app.db.close();rmSync(dir,{recursive:true,force:true});});
  const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/dashboard`,{headers:{Cookie:'session='+cookie}});assert.equal(response.status,200);const saved=await response.json();
  assert.equal(saved.pets[0].notes,'Keep notes');assert.equal(saved.pets[0].archived,1);assert.equal(saved.pets[0].deleted_at,null);assert.equal(saved.tasks[0].note,'Keep note');assert.equal(saved.events[0].action,'complete');assert.deepEqual(saved.records,[]);assert.equal(app.db.prepare('PRAGMA user_version').get().user_version,3);
});
