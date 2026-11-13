import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.js';

async function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'pawroster-home-delete-')),path=join(dir,'test.db');let app=createApp({dbPath:path}),url;
 const start=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${app.server.address().port}`;};await start();
 t.after(async()=>{await new Promise(r=>app.server.close(r));app.db.close();rmSync(dir,{recursive:true,force:true});});
 const client=()=>{let cookie='';return async(p,data,status=200,headers={})=>{const r=await fetch(url+'/api/'+p,{method:data===undefined?'GET':'POST',headers:{Cookie:cookie,...headers,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};};
 const owner=client(),member=client(),other=client();
 await owner('register',{name:'Owner',home:'Old home',email:'owner@example.com',password:'test-password-123'},201);const initial=await owner('dashboard');
 await member('register',{name:'Member',invite:initial.user.invite,email:'member@example.com',password:'test-password-123'},201);
 await other('register',{name:'New owner',home:'New home',email:'other@example.com',password:'test-password-123'},201);
 const restart=async()=>{await new Promise(r=>app.server.close(r));app.db.close();app=createApp({dbPath:path});await start();};
 return {owner,member,other,initial,client,database:()=>app.db,restart};
}
const confirmation=d=>({home_id:d.user.home_id,confirm_name:d.user.home_name,confirm_invite:d.user.invite});
const tables=['homes','users','memberships','sessions','pets','tasks','events','pet_records','home_blocks','home_events'];
const snapshot=db=>Object.fromEntries(tables.map(name=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]));

test('H1 two members move to another home; deleting the old home preserves accounts and all other-home data',async t=>{
 const {owner,member,other,initial,client,database,restart}=await fixture(t),anotherSession=client();
 await anotherSession('login',{email:'member@example.com',password:'test-password-123'});
 const pet=await owner('pets',{name:'Old pet',species:'cat'},201),task=await member('tasks',{pet_id:pet.id,title:'Old care',due:new Date().toISOString()},201);
 await member(`tasks/${task.id}/claim`,{});await owner('records',{pet_id:pet.id,kind:'visit',title:'Old record',recorded_at:new Date().toISOString(),due_at:new Date(Date.now()+86400000).toISOString()},201);
 const outsiderId=(await other('dashboard')).user.id;database().prepare('INSERT INTO home_blocks VALUES(?,?,?,?)').run(initial.user.home_id,outsiderId,initial.user.id,new Date().toISOString());
 const destination=await other('dashboard'),newPet=await other('pets',{name:'Keep pet',species:'dog'},201);await other('tasks',{pet_id:newPet.id,title:'Keep care',due:new Date().toISOString()},201);
 await owner('homes/join',{invite:destination.user.invite},201);await member('homes/join',{invite:destination.user.invite},201);
 const otherBefore=await other('dashboard'),accounts=database().prepare('SELECT * FROM users ORDER BY id').all();
 await owner('homes/switch',{home_id:initial.user.home_id});await owner('homes/delete',confirmation(await owner('dashboard')));
 assert.deepEqual(database().prepare('SELECT * FROM users ORDER BY id').all(),accounts);assert.deepEqual(database().prepare('PRAGMA foreign_key_check').all(),[]);
 for(const account of [owner,member,anotherSession]){const d=await account('dashboard');assert.equal(d.homes.length,1);assert.equal(d.user.home_id,destination.user.home_id);assert.equal(d.user.role,'member');assert.equal(d.pets[0].id,newPet.id);await account('homes/switch',{home_id:initial.user.home_id},403);}
 assert.deepEqual(await other('dashboard'),otherBefore);
 for(const table of ['homes','memberships','pets','home_blocks','home_events']){const column=table==='homes'?'id':'home_id';assert.equal(database().prepare(`SELECT count(*) n FROM ${table} WHERE ${column}=?`).get(initial.user.home_id).n,0);}
 assert.equal(database().prepare('SELECT count(*) n FROM tasks WHERE pet_id=?').get(pet.id).n,0);assert.equal(database().prepare('SELECT count(*) n FROM pet_records WHERE pet_id=?').get(pet.id).n,0);assert.equal(database().prepare('SELECT count(*) n FROM events WHERE task_id=?').get(task.id).n,0);
 await other('homes/join',{invite:initial.user.invite},400);const visitor=client();await visitor('register',{name:'Visitor',invite:initial.user.invite,email:'visitor@example.com',password:'test-password-123'},400);
 await restart();const relogin=client();await relogin('login',{email:'owner@example.com',password:'test-password-123'});assert.equal((await relogin('dashboard')).user.home_id,destination.user.home_id);
});

test('H2 home deletion rejects non-owner, incorrect confirmation and stale home/invite without changing data',async t=>{
 const {owner,member,other,database}=await fixture(t),before=await owner('dashboard'),payload=confirmation(before),all=snapshot(database());
 await member('homes/delete',payload,403);await other('homes/delete',payload,409);
 await owner('homes/delete',{...payload,confirm_name:'wrong'},400);await owner('homes/delete',{...payload,home_id:999},409);await owner('homes/delete',{...payload,confirm_invite:'old'},409);await owner('homes/delete',{confirm_name:'Old home'},409);
 assert.deepEqual(snapshot(database()),all);
 await owner('homes/invite/rotate',{});await owner('homes/delete',payload,409);assert.equal((await owner('dashboard')).members.length,2);
});

test('H3 deleting the last home leaves valid accounts and sessions able to join or create homes again',async t=>{
 const {owner,member,other,initial,client,restart}=await fixture(t);await owner('homes/delete',confirmation(await owner('dashboard')));
 for(const account of [owner,member]){const d=await account('dashboard');assert.equal(d.user.home_id,null);assert.deepEqual(d.homes,[]);assert.deepEqual(d.pets,[]);}
 await owner('homes/delete',confirmation(initial),409);await restart();assert.equal((await owner('dashboard')).user.home_id,null);
 const destination=await other('dashboard');await member('homes/join',{invite:destination.user.invite},201);await owner('homes',{name:'Fresh home'},201);
 const renewed=await owner('dashboard');assert.equal(renewed.user.role,'owner');
 await owner('homes/delete',confirmation(initial),409);assert.equal((await owner('dashboard')).user.home_name,'Fresh home');
 const again=client();await again('login',{email:'member@example.com',password:'test-password-123'});assert.equal((await again('dashboard')).user.home_id,destination.user.home_id);
 const visitor=client();await visitor('register',{name:'New person',home:'Another',email:'new@example.com',password:'test-password-123'},201);
});

test('H4 a failed home deletion rolls back all related data, memberships and selected sessions atomically',async t=>{
 const {owner,member,database}=await fixture(t),pet=await owner('pets',{name:'Pet',species:'cat'},201),task=await member('tasks',{pet_id:pet.id,title:'Care',due:new Date().toISOString()},201);
 await member(`tasks/${task.id}/claim`,{});await member('records',{pet_id:pet.id,kind:'note',title:'Keep note',recorded_at:new Date().toISOString()},201);
 const payload=confirmation(await owner('dashboard')),before=snapshot(database());
 database().exec("CREATE TRIGGER reject_home_delete BEFORE DELETE ON homes BEGIN SELECT RAISE(ABORT,'Synthetic home failure'); END");
 await owner('homes/delete',payload,503);assert.deepEqual(snapshot(database()),before);assert.deepEqual(database().prepare('PRAGMA foreign_key_check').all(),[]);
 database().exec('DROP TRIGGER reject_home_delete');await owner('homes/delete',payload);assert.equal((await member('dashboard')).homes.length,0);
});

test('H5 schema 4 migration removes legacy home coupling and preserves identities, credentials, sessions and memberships',async t=>{
 const {owner,member,initial,database,restart}=await fixture(t),db=database();
 // Recreate the legacy field from a real pre-delete schema, then exercise the version-4 upgrade path.
 db.exec('ALTER TABLE users ADD COLUMN home_id INTEGER REFERENCES homes(id)');db.prepare('UPDATE users SET home_id=?').run(initial.user.home_id);db.exec('PRAGMA user_version=4');
 const before=snapshot(db);await restart();const after=snapshot(database());
 assert.equal(database().prepare('PRAGMA user_version').get().user_version,5);assert.ok(!database().prepare('PRAGMA table_info(users)').all().some(c=>c.name==='home_id'));
 const withoutLegacy=before.users.map(({home_id,...u})=>u);assert.deepEqual(JSON.parse(JSON.stringify(after.users)),withoutLegacy);
 for(const name of tables.filter(x=>x!=='users'))assert.deepEqual(after[name],before[name]);
 assert.equal((await member('dashboard')).user.home_id,initial.user.home_id);await owner('homes/delete',confirmation(await owner('dashboard')));assert.equal((await member('dashboard')).user.home_id,null);
 assert.deepEqual(database().prepare('PRAGMA foreign_key_check').all(),[]);
});
