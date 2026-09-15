import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,validateBackup,escapeHtml,parseChecklist,revisedChecks,checklistName} from '../public/model.js';
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
test('editing checklist keeps only unchanged checks and rejects ambiguous or excessive items',()=>{
  const lines=parseChecklist('  Golv  \n\n Fönster\n');
  assert.deepEqual(lines,['Golv','Fönster']);
  assert.deepEqual(revisedChecks([{text:'Golv',done:true},{text:'Fönster invändigt',done:true}],lines),[{text:'Golv',done:true},{text:'Fönster',done:false}]);
  for(const bad of ['', 'Golv\nGolv', 'x'.repeat(241),Array.from({length:41},(_,i)=>String(i)).join('\n')])assert.throws(()=>parseChecklist(bad));
});
test('custom template starts fresh and has an independent checklist snapshot',()=>{
  const checklist={name:'Kontorsstädning',items:['Skrivbord','Pentry']};
  const p=newProject({title:'A',checklist});checklist.items[0]='Nytt moment';
  assert.equal(checklistName(p),'Kontorsstädning');assert.deepEqual(p.checks,[{text:'Skrivbord',done:false},{text:'Pentry',done:false}]);
});
test('v1 migrates without deleting library; v2 validates custom checklist names and templates',()=>{
  const legacy=newProject({title:'Gammalt',template:'cleaning'});delete legacy.checklistName;
  const old=validateBackup({app:'klart',version:1,projects:[legacy],profile:{}});
  assert.equal(old.version,3);assert.equal(old.projects[0].checklistName,'Städning');assert.equal(old.checklistTemplates,undefined);assert.equal(old.profile.logo,'');
  const modern={app:'klart',version:2,projects:[{...legacy,checklistName:'Kök <test>'}],profile:{},checklistTemplates:[{id:'a',name:'Flyttstädning',items:['Kyl','Frys']}]};
  assert.equal(validateBackup(modern).checklistTemplates[0].items.length,2);
  assert.throws(()=>validateBackup({...modern,checklistTemplates:[modern.checklistTemplates[0],modern.checklistTemplates[0]]}));
  assert.throws(()=>validateBackup({...modern,checklistTemplates:[{id:'a',name:'Fel',items:['Kök\nHall']}]}));
  assert.throws(()=>validateBackup({...modern,projects:[{...legacy,checklistName:9}]}));
});
test('logo backup accepts bounded local PNG data and rejects remote or executable sources',()=>{
  const base={app:'klart',version:3,projects:[],checklistTemplates:[],profile:{company:'Åberg'}};
  assert.equal(validateBackup(base).profile.logo,'');
  for(const logo of ['https://example.com/logo.png','data:image/svg+xml;base64,AAAA','data:image/png;base64,'+'A'.repeat(1200000),{}])assert.throws(()=>validateBackup({...base,profile:{logo}}));
  assert.equal(validateBackup({...base,profile:{logo:'data:image/png;base64,AAAA'}}).profile.logo,'data:image/png;base64,AAAA');
  assert.equal(validateBackup({...base,version:2}).profile.logo,'');
});
