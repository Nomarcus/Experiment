import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';

async function create(page,title='Fönsterputs hos Öberg'){
  await page.goto('/');await page.getByRole('button',{name:'＋ Nytt uppdrag'}).click();
  await page.getByLabel('Uppdragets namn *',{exact:true}).fill(title);
  await page.getByLabel('Kund',{exact:true}).fill('Åsa Öberg');
  await page.getByLabel('Adress / arbetsplats',{exact:true}).fill('Ängsvägen 12');
  await page.getByRole('button',{name:'Skapa uppdrag →'}).click();
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
}
test('create, edit, reload, filter and safely render untrusted text',async({page})=>{
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await create(page);
  await page.getByLabel('Vad vill du lämna över till kunden?').fill('Rent och fint. <img src=x onerror="window.injected=true">');
  await page.getByText('Utgångsläge dokumenterat',{exact:true}).click();
  await page.getByLabel('Uppdragets status').selectOption('ready');
  await expect(page.locator('#save-state')).toHaveText('✓ Alla ändringar sparade');
  await page.reload();await page.getByRole('button',{name:/Fönsterputs hos Öberg/}).click();
  await expect(page.getByLabel('Vad vill du lämna över till kunden?')).toContainText('Rent och fint.');
  await expect(page.getByLabel('Utgångsläge dokumenterat')).toBeChecked();
  await page.getByRole('button',{name:'Förhandsvisa rapport ↗'}).click();
  await expect(page.locator('.report-text')).toContainText('<img');expect(await page.evaluate(()=>window.injected)).toBeUndefined();
  await page.getByRole('button',{name:'Mina uppdrag',exact:false}).click();
  await page.getByLabel('Sök uppdrag').fill('saknas');await expect(page.getByText('Inga uppdrag matchar')).toBeVisible();
  await page.getByLabel('Sök uppdrag').fill('Öberg');await expect(page.locator('.project-card')).toHaveCount(1);
  expect(errors).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('example photos create a valid PDF, backup and atomic restore',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Prova med ett exempel ↗'}).click();
  await expect(page.locator('.photo img')).toHaveCount(2);
  await page.getByLabel('Bildtext 1',{exact:true}).fill('Före: Åäö är korrekt i PDF.');
  await expect(page.locator('#save-state')).toHaveText('✓ Alla ändringar sparade');
  const pdfDownload=page.waitForEvent('download');await page.getByRole('button',{name:'↓ Ladda ner PDF',exact:true}).click();
  const pdf=await pdfDownload;const bytes=await readFile(await pdf.path());const doc=await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);expect(doc.getTitle()).toBe('Exempel: Slutstädning av vardagsrum');
  await page.getByRole('button',{name:'Företag & säkerhetskopia',exact:false}).click();
  await page.getByLabel('Företagsnamn',{exact:true}).fill('Öbergs Städ');await page.getByRole('button',{name:'Spara företagsuppgifter'}).click();
  await expect(page.locator('#toast')).toHaveText('Dina företagsuppgifter är sparade.');
  const backupDownload=page.waitForEvent('download');await page.getByRole('button',{name:'↓ Ladda ner säkerhetskopia'}).click();
  const backup=await backupDownload;const backupPath=await backup.path();const json=JSON.parse(await readFile(backupPath,'utf8'));
  expect(json.projects[0].photos).toHaveLength(2);expect(json.profile.company).toBe('Öbergs Städ');
  await page.getByRole('button',{name:'Mina uppdrag',exact:false}).click();await page.locator('.project-card').click();
  await page.getByRole('button',{name:'Radera uppdrag',exact:true}).click();await page.locator('#confirm-action').click();
  await expect(page.getByText('Ditt första uppdrag börjar här')).toBeVisible();
  await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});
  await page.getByRole('button',{name:'Återställ',exact:true}).click();await expect(page.locator('.project-card')).toHaveCount(1);
  await page.locator('.project-card').click();await expect(page.locator('.photo img')).toHaveCount(2);await expect(page.getByLabel('Bildtext 1',{exact:true})).toHaveValue('Före: Åäö är korrekt i PDF.');
});
test('uploads, reorders, removes and persists actual images',async({page})=>{
  await create(page,'Bilder på arbetsplatsen');
  const png=await page.locator('h1').screenshot();
  await page.locator('#photos').setInputFiles([{name:'first.png',mimeType:'image/png',buffer:png},{name:'second.png',mimeType:'image/png',buffer:png}]);
  await expect(page.locator('.photo img')).toHaveCount(2);
  await page.getByLabel('Bildtext 1',{exact:true}).fill('Första');await page.getByLabel('Bildtext 2',{exact:true}).fill('Andra');
  await page.getByRole('button',{name:'Flytta bild 2 tidigare',exact:true}).click();await expect(page.getByLabel('Bildtext 1',{exact:true})).toHaveValue('Andra');
  await page.getByRole('button',{name:'Ta bort bild 2',exact:true}).click();await page.locator('#confirm-action').click();
  await expect(page.locator('.photo img')).toHaveCount(1);await expect(page.locator('#save-state')).toHaveText('✓ Alla ändringar sparade');
  await page.reload();await page.locator('.project-card').click();await expect(page.locator('.photo img')).toHaveCount(1);
});
test('offline reload, editing and PDF work without network',async({page,context})=>{
  await page.goto('/');await page.getByRole('button',{name:'Prova med ett exempel ↗'}).click();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
  await context.setOffline(true);await page.reload();await page.locator('.project-card').click();
  await page.getByLabel('Vad vill du lämna över till kunden?').fill('Sparat utan internet.');await expect(page.locator('#save-state')).toHaveText('✓ Alla ändringar sparade');
  const event=page.waitForEvent('download');await page.getByRole('button',{name:'↓ Ladda ner PDF',exact:true}).click();expect((await event).suggestedFilename()).toMatch(/\.pdf$/);
  await page.reload();await page.locator('.project-card').click();await expect(page.getByLabel('Vad vill du lämna över till kunden?')).toHaveValue('Sparat utan internet.');
});
test('rejects corrupt backups without replacing existing work',async({page})=>{
  await create(page,'Behåll mig');
  await page.locator('#import-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"app":"klart","version":1,"projects":[{"title":"bad"}]}')});
  await expect(page.locator('#toast')).toContainText('inte en giltig');
  await page.reload();await expect(page.locator('.project-card')).toContainText('Behåll mig');
});
test('second tab cannot overwrite an open project',async({page,context})=>{
  await create(page,'Skyddat uppdrag');
  const other=await context.newPage();await other.goto('/');await expect(other.getByRole('heading',{name:'Klart är redan öppet'})).toBeVisible();
  await page.close();await other.getByRole('button',{name:'Ladda om'}).click();await expect(other.locator('.project-card')).toContainText('Skyddat uppdrag');
});
