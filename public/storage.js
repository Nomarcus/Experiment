let dbPromise;
function database() {
  return dbPromise ||= new Promise((resolve,reject)=>{
    const request=indexedDB.open('klart-local',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('projects',{keyPath:'id'});request.result.createObjectStore('settings');};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('Lokal lagring kunde inte öppnas. Kontrollera webbläsarens inställningar.'));
  });
}
async function transaction(store,mode,action) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,mode);
    const request=action(tx.objectStore(store));
    tx.oncomplete=()=>resolve(request?.result);
    tx.onerror=()=>reject(new Error('Kunde inte spara. Lagringen kan vara full. Ta en säkerhetskopia innan du stänger.'));
    tx.onabort=()=>reject(new Error('Sparandet avbröts. Dina senaste ändringar är inte sparade.'));
  });
}
export const getProjects=()=>transaction('projects','readonly',s=>s.getAll());
export const putProject=p=>transaction('projects','readwrite',s=>s.put(p));
export const deleteProject=id=>transaction('projects','readwrite',s=>s.delete(id));
export const getProfile=()=>transaction('settings','readonly',s=>s.get('profile'));
export const putProfile=p=>transaction('settings','readwrite',s=>s.put(p,'profile'));
export const getChecklistTemplates=async()=>await transaction('settings','readonly',s=>s.get('checklistTemplates')) || [];
export const putChecklistTemplates=items=>transaction('settings','readwrite',s=>s.put(items,'checklistTemplates'));
export async function importBackup(backup) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['projects','settings'],'readwrite');
    for(const p of backup.projects) tx.objectStore('projects').put(p);
    tx.objectStore('settings').put(backup.profile,'profile');
    if(backup.checklistTemplates!==undefined){
      const request=tx.objectStore('settings').get('checklistTemplates');
      request.onsuccess=()=>{
        const merged=new Map((request.result || []).map(t=>[t.id,t]));
        for(const t of backup.checklistTemplates)merged.set(t.id,t);
        if(merged.size>50){tx.abort();return;}
        tx.objectStore('settings').put([...merged.values()],'checklistTemplates');
      };
    }
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(new Error('Kunde inte återställa säkerhetskopian. Inga ändringar sparades.'));
    tx.onabort=()=>reject(new Error('Återställningen avbröts. Inga ändringar sparades.'));
  });
}
