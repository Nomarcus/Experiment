import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,validateBackup,escapeHtml} from '../public/model.js';
test('projects require a title and start with independent checklists',()=>{
  assert.throws(()=>newProject({title:'  '}));
  const a=newProject({title:'  Måleri  ',template:'painting'}),b=newProject({title:'B',template:'painting'});
  assert.equal(a.title,'Måleri');a.checks[0].done=true;assert.equal(b.checks[0].done,false);assert.notEqual(a.id,b.id);
});
test('backup rejects executable image sources, invalid structures and duplicate IDs',()=>{
  const p=newProject({title:'A'}),base={app:'klart',version:1,projects:[p],profile:{company:'Åbergs'}};
  assert.equal(validateBackup(base).profile.company,'Åbergs');
  assert.throws(()=>validateBackup({...base,version:2}));
  assert.throws(()=>validateBackup({...base,projects:[p,p]}));
  assert.throws(()=>validateBackup({...base,projects:[{...p,photos:[{id:'1',kind:'other',caption:'',data:'data:image/svg+xml,<svg onload=alert(1) />'}]}]}));
  assert.throws(()=>validateBackup({...base,projects:[{...p,status:'constructor'}]}));
  assert.throws(()=>validateBackup({...base,projects:[{...p,template:'__proto__'}]}));
});
test('backup import drops unknown properties and preserves Swedish text',()=>{
  const p=newProject({title:'Åtgärd hos Öberg'});const valid=validateBackup({app:'klart',version:1,projects:[{...p,unsafe:'not imported'}],profile:{company:'Ärlig Service',unsafe:'x'}});
  assert.equal(valid.projects[0].title,p.title);assert.equal(valid.projects[0].unsafe,undefined);assert.equal(valid.profile.unsafe,undefined);
});
test('user text is escaped for HTML, including attributes',()=>{assert.equal(escapeHtml('<img src=x onerror="x"> &'), '&lt;img src=x onerror=&quot;x&quot;&gt; &amp;');});
