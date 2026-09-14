export const templates = {
  service: { name: 'Service & underhåll', checks: ['Utgångsläge dokumenterat', 'Arbetet genomfört', 'Funktion kontrollerad', 'Arbetsplatsen lämnad i ordning'] },
  cleaning: { name: 'Städning', checks: ['Utgångsläge dokumenterat', 'Överenskomna ytor rengjorda', 'Slutkontroll genomförd', 'Nycklar och tillträde hanterade'] },
  painting: { name: 'Måleri', checks: ['Underlag kontrollerat', 'Ytor skyddade', 'Måleriarbete genomfört', 'Slutresultat kontrollerat'] },
  garden: { name: 'Trädgård', checks: ['Arbetsområdet dokumenterat', 'Överenskommet arbete klart', 'Avfall omhändertaget', 'Slutresultat dokumenterat'] }
};
export const statuses = {active:'Pågående',ready:'Klart för kund',archived:'Arkiverat'};
export function localDate() {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function newProject({title,customer='',address='',date=localDate(),template='service'}) {
  if(!title?.trim()) throw new Error('Skriv ett namn på uppdraget.');
  if(!templates[template]) throw new Error('Välj en giltig mall.');
  return {id:crypto.randomUUID(), title:title.trim().slice(0,160), customer:customer.trim().slice(0,160),address:address.trim().slice(0,240),date,template,status:'active',summary:'',photos:[],checks:templates[template].checks.map(text=>({text,done:false})),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
export function escapeHtml(s='') {return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function validateBackup(value) {
  const fail = () => {throw new Error('Filen är inte en giltig Klart-säkerhetskopia.');};
  const str = (x,n=10000) => typeof x === 'string' && x.length<=n;
  const date = x => /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x));
  if(!value || value.app!=='klart' || value.version!==1 || !Array.isArray(value.projects) || value.projects.length>500) fail();
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
    return {id:p.id,title:p.title,customer:p.customer,address:p.address,summary:p.summary,date:p.date,template:p.template,status:p.status,photos,checks,createdAt:p.createdAt,updatedAt:p.updatedAt};
  });
  const raw=value.profile || {};
  for(const k of ['company','name','email','phone']) if(raw[k]!==undefined && !str(raw[k],240)) fail();
  return {app:'klart',version:1,projects,profile:Object.fromEntries(['company','name','email','phone'].map(k=>[k,raw[k]||'']))};
}
