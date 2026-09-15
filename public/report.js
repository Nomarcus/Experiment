import { escapeHtml as e, statuses, checklistName } from './model.js';
export const kinds={before:'Före',after:'Efter',other:'Dokumentation'};
export function reportHtml(p,profile) {
  return `<article class="report-preview"><header class="report-header">${profile.logo?`<img class="report-logo" src="${e(profile.logo)}" alt="Företagets logotyp">`:""}<p class="eyebrow">${e(profile.company || 'ARBETSRAPPORT')}</p><h1>${e(p.title)}</h1><span class="tag ${e(p.status)}">${e(statuses[p.status])}</span></header><div class="report-meta"><div><strong>Kund</strong>${e(p.customer || 'Ej angiven')}</div><div><strong>Arbetsdatum</strong>${e(p.date)}</div><div><strong>Plats</strong>${e(p.address || 'Ej angiven')}</div><div><strong>Utfört av</strong>${e(profile.name || profile.company || 'Ej angivet')}</div></div>${p.summary?`<h2>Utfört arbete</h2><p class="report-text">${e(p.summary)}</p>`:''}<h2>Checklista · ${e(checklistName(p))}</h2><div class="check-summary">${p.checks.map(c=>`<div>${c.done?'☑':'☐'} ${e(c.text)}</div>`).join('')}</div><h2 style="margin-top:30px">Fotodokumentation</h2>${p.photos.length?p.photos.map((ph,i)=>`<figure class="report-photo"><img src="${e(ph.data)}" alt="${e(ph.caption||kinds[ph.kind])}"><figcaption><strong>${i+1}. ${kinds[ph.kind]}</strong>${ph.caption?`<br>${e(ph.caption)}`:''}</figcaption></figure>`).join(''):'<p>Inga foton tillagda.</p>'}<footer>${e([profile.company,profile.name,profile.email,profile.phone].filter(Boolean).join(' · '))}<br>Skapad med Klart · ${e(new Date().toLocaleDateString('sv-SE'))}. Uppgifterna har angetts av utföraren.</footer></article>`;
}
export function download(data,name,type) {
  const blob=data instanceof Blob?data:new Blob([data],{type});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function filename(title) {return (title.replace(/[^a-zåäöé0-9 -]/gi,'').trim().replace(/\s+/g,'-').slice(0,65) || 'arbetsrapport');}
export async function makePdf(p,profile) {
  if(!window.PDFLib) throw new Error('PDF-motorn kunde inte laddas. Öppna förhandsvisningen och välj Skriv ut / PDF.');
  const { PDFDocument, StandardFonts, rgb }=window.PDFLib;
  const doc=await PDFDocument.create();
  const font=await doc.embedFont(StandardFonts.Helvetica), bold=await doc.embedFont(StandardFonts.HelveticaBold);
  const fullText=[p.title,checklistName(p),p.customer,p.address,p.summary,...p.checks.map(c=>c.text),...p.photos.map(ph=>ph.caption),profile.company || "",profile.name || "",profile.email || "",profile.phone || ""].join(' ');
  try {font.encodeText(fullText.replace(/[\n\r\t]/g,' '));}catch{throw new Error('Texten innehåller tecken som PDF-nedladdningen inte stöder. Välj Skriv ut / PDF i förhandsvisningen för att behålla alla tecken.');}
  const green=rgb(.07,.24,.19),muted=rgb(.44,.49,.41),line=rgb(.86,.89,.82);
  let page,y;
  function addPage(){page=doc.addPage([595.28,841.89]);y=784;}
  function need(height){if(y-height<65) addPage();}
  function wrapped(text,size=11,strong=false,color=green){
    const f=strong?bold:font;
    for(const paragraph of String(text).replace(/\r/g,'').split('\n')){
      let current='';
      const flush=()=>{need(size*1.5);if(current)page.drawText(current,{x:52,y,size,font:f,color});y-=size*1.5;current='';};
      for(const word of paragraph.trim().split(/\s+/)){
        const candidate=current?current+' '+word:word;
        if(f.widthOfTextAtSize(candidate,size)<=491){current=candidate;continue;}
        if(current)flush();
        for(const char of word){if(current && f.widthOfTextAtSize(current+char,size)>491)flush();current+=char;}
      }
      need(size*1.5);if(current)page.drawText(current,{x:52,y,size,font:f,color});y-=size*1.5;
    }
  }
  function heading(text){need(55);y-=15;wrapped(text,14,true);y-=8;}
  addPage();
  if(profile.logo){const logo=await doc.embedPng(profile.logo);const scale=Math.min(160/logo.width,60/logo.height);const width=logo.width*scale,height=logo.height*scale;page.drawImage(logo,{x:52,y:y-height,width,height});y-=height+18;}
  wrapped(profile.company || 'ARBETSRAPPORT',10,true,muted);y-=17;wrapped(p.title,24,true);y-=6;wrapped(statuses[p.status]+' · '+p.date,10,false,muted);y-=18;
  page.drawLine({start:{x:52,y},end:{x:543,y},thickness:2,color:green});y-=27;
  wrapped('Kund: '+(p.customer || 'Ej angiven'));wrapped('Plats: '+(p.address || 'Ej angiven'));wrapped('Utfört av: '+(profile.name || profile.company || 'Ej angivet'));
  if(p.summary){heading('Utfört arbete');wrapped(p.summary);}
  heading('Checklista · '+checklistName(p));
  for(const check of p.checks)wrapped((check.done?'[x] ':'[  ] ')+check.text,11);
  const contact=[profile.company,profile.email,profile.phone].filter(Boolean).join(' · ');
  if(contact){heading('Kontakt');wrapped(contact,10,false,muted);}
  if(p.photos.length)addPage();
  heading('Fotodokumentation');
  if(!p.photos.length) wrapped('Inga foton tillagda.',11,false,muted);
  for(let i=0;i<p.photos.length;i++){
    const ph=p.photos[i];const img=await doc.embedJpg(ph.data);const scale=Math.min(491/img.width,250/img.height);const w=img.width*scale,h=img.height*scale;
    need(h+65);wrapped(`${i+1}. ${kinds[ph.kind]}`,12,true);y-=8;
    page.drawImage(img,{x:52+(491-w)/2,y:y-h,width:w,height:h});y-=h+16;
    if(ph.caption)wrapped(ph.caption,10,false,muted);y-=15;
  }
  const pages=doc.getPages();for(let i=0;i<pages.length;i++){
    const pg=pages[i];pg.drawLine({start:{x:52,y:46},end:{x:543,y:46},thickness:.5,color:line});
    pg.drawText('Skapad med Klart · Uppgifter från utföraren',{x:52,y:31,size:8,font,color:muted});
    pg.drawText(`${i+1} / ${pages.length}`,{x:508,y:31,size:8,font,color:muted});
  }
  doc.setTitle(p.title);doc.setAuthor(profile.company || 'Klart');doc.setSubject('Arbetsrapport med fotodokumentation');
  return doc.save();
}
