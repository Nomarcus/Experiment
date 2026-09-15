export const templates = {
  service: { name: 'Service & underhåll', checks: ['Utgångsläge dokumenterat', 'Arbetet genomfört', 'Funktion kontrollerad', 'Arbetsplatsen lämnad i ordning'] },
  cleaning: { name: 'Städning', checks: ['Utgångsläge dokumenterat', 'Överenskomna ytor rengjorda', 'Slutkontroll genomförd', 'Nycklar och tillträde hanterade'] },
  painting: { name: 'Måleri', checks: ['Underlag kontrollerat', 'Ytor skyddade', 'Måleriarbete genomfört', 'Slutresultat kontrollerat'] },
  garden: { name: 'Trädgård', checks: ['Arbetsområdet dokumenterat', 'Överenskommet arbete klart', 'Avfall omhändertaget', 'Slutresultat dokumenterat'] }
};
export const statuses = {active:'Pågående',ready:'Klart för kund',archived:'Arkiverat'};
export function localDate() {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function checklistName(p) {return p.checklistName || templates[p.template].name;}
export function parseChecklist(text) {
  const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!lines.length || lines.length>40) throw new Error('Ange mellan 1 och 40 arbetsmoment, ett per rad.');
  if(lines.some(s=>s.length>240)) throw new Error('Ett arbetsmoment får innehålla högst 240 tecken.');
  if(new Set(lines).size!==lines.length) throw new Error('Varje arbetsmoment behöver ha en egen text.');
  return lines;
}
export function revisedChecks(previous,lines) {
  return lines.map(text=>({text,done:previous.some(c=>c.text===text && c.done)}));
}
export function newProject({title,customer='',address='',date=localDate(),template='service',checklist}) {
  if(!title?.trim()) throw new Error('Skriv ett namn på uppdraget.');
  if(!Object.hasOwn(templates,template)) throw new Error('Välj en giltig mall.');
  const lines=checklist?parseChecklist(checklist.items.join('\n')):templates[template].checks;
  return {id:crypto.randomUUID(), title:title.trim().slice(0,160), customer:customer.trim().slice(0,160),address:address.trim().slice(0,240),date,template,checklistName:checklist?.name || templates[template].name,status:'active',summary:'',photos:[],checks:lines.map(text=>({text,done:false})),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
export function escapeHtml(s='') {return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function validateBackup(value) {
  const fail = () => {throw new Error('Filen är inte en giltig Klart-säkerhetskopia.');};
  const str = (x,n=10000) => typeof x === 'string' && x.length<=n;
  const date = x => /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x));
  if(!value || value.app!=='klart' || ![1,2].includes(value.version) || !Array.isArray(value.projects) || value.projects.length>500) fail();
  const ids=new Set();
  const projects=value.projects.map(p=>{
    if(!p || !str(p.id,100) || !p.id || ids.has(p.id) || !str(p.title,160) || !p.title.trim() || !str(p.customer,160) || !str(p.address,240) || !str(p.summary) || !date(p.date) || !Object.hasOwn(templates,p.template) || !Object.hasOwn(statuses,p.status) || !Array.isArray(p.photos) || p.photos.length>100 || !Array.isArray(p.checks) || p.checks.length>40 || !str(p.createdAt,40) || !str(p.updatedAt,40)) fail();
    ids.add(p.id);
    const photoIds=new Set();
    const photos=p.photos.map(ph=>{
      if(!ph || !str(ph.id,100) || !ph.id || photoIds.has(ph.id) || !str(ph.caption,1000) || !['before','after','other'].includes(ph.kind) || !str(ph.data,8000000) || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(ph.data)) fail();
      photoIds.add(ph.id);
      return {id:ph.id,caption:ph.caption,kind:ph.kind,data:ph.data};
    });
    const checks=p.checks.map(c=>{if(!c || !str(c.text,240) || typeof c.done!=='boolean') fail();return {text:c.text,done:c.done};});
    if(p.checklistName!==undefined && (!str(p.checklistName,100) || !p.checklistName.trim())) fail();
    return {id:p.id,title:p.title,customer:p.customer,address:p.address,summary:p.summary,date:p.date,template:p.template,checklistName:p.checklistName || templates[p.template].name,status:p.status,photos,checks,createdAt:p.createdAt,updatedAt:p.updatedAt};
  });
  const raw=value.profile || {};
  for(const k of ['company','name','email','phone']) if(raw[k]!==undefined && !str(raw[k],240)) fail();
  let checklistTemplates;
  if(value.version===2){
    if(!Array.isArray(value.checklistTemplates) || value.checklistTemplates.length>50) fail();
    const templateIds=new Set();
    checklistTemplates=value.checklistTemplates.map(t=>{
      if(!t || !str(t.id,100) || !t.id || templateIds.has(t.id) || !str(t.name,100) || !t.name.trim() || !Array.isArray(t.items) || t.items.some(s=>!str(s,240))) fail();
      templateIds.add(t.id);
      let items;try{items=parseChecklist(t.items.join('\n'));}catch{fail();}
      if(items.length!==t.items.length)fail();
      return {id:t.id,name:t.name,items};
    });
  }
  return {app:'klart',version:2,projects,checklistTemplates,profile:Object.fromEntries(['company','name','email','phone'].map(k=>[k,raw[k]||'']))};
}
