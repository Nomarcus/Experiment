# Arbetslogg

## 2026-09-14 — första byggpasset

**Uppdrag:** användaren gav fria händer att undersöka och bygga en kommersiellt rimlig fristående app i det länkade repot. Återkommande arbete varannan timme under några dagar. Ingen exakt tokenbudget angavs; använd kapacitet produktivt utan att köpa krediter eller kringgå gränser.

**Repo:** `Nomarcus/Experiment`, ID `1370181938`, publikt, ursprungligen bara README. Lokal klon: `work/Experiment` i ursprungsuppgiftens arbetsmapp.

**Automation:** heartbeat `bygg-och-f-rb-ttra-experiment`, ACTIVE, varannan timme, samma Codex-uppgift. Arbeta till och med 18 september 2026, leverera slutstatus och pausa sedan. Håll tyst om inget betydelsefullt ändrats.

### Levererat i källkoden

- Klart, en svensk app för fotobaserade kundrapporter, med städning som första tänkta pilotnisch.
- Fristående statiska filer, vanliga JS-moduler, lokal IndexedDB, service worker, lokal PDF-motor.
- Uppdrag, företagsuppgifter, 4 mallar, checklistor, foton med bildtexter/före-efter/ordning, PDF och utskriftsvy.
- Validerad backupimport i en transaktion, export av allt, tydliga lokallagringsgränser.
- Offlinecache med bygginnehåll som versionsnyckel; fliklås när Web Locks stöds.
- Responsiv grön/neutral design, illustrerat exempel tydligt markerat.
- Codespaces-konfiguration, byggskript, enhetstester och browsertester, CI samt planerad gratis demopublicering via Pages efter godkända tester.
- Research och lanseringshypotes i docs. Gratis konkurrent identifierad: ingen verifierad betalningsvilja eller unikhet hävdas.

### Verifieringsfynd

- Fyra modell-/import-/escapingtester passerade.
- Första browserkörningen: 8 av 10 passerade på Chromium desktop och mobilstorlek. De två bildtesten använde en trasig PNG-fixture; appen avvisade den korrekt.
- Testet ändrades till en verklig PNG från webbläsaren; båda bildflödestesten passerade därefter (import, ordning, radering, omladdning).
- Slutlig full lokal körning: **4 enhetstester + 12 browserfall godkända**, inklusive fliklås, desktop och mobilstorlek. Bygge och `git diff --check` godkända.
- Visuell desktopkontroll utförd via agent-browser. Mobil layout kontrolleras också med skärmdump före första leverans.

### Kvarstående gränser

Betalning och fysisk mobilverifiering saknas. PDF-nedladdning har WinAnsi-teckengräns; utskriftsväg är dokumenterad för andra tecken. HEIC stöds inte. Profil saknar logotyp, checklistor är inte redigerbara ännu. Stora datamängder och lagringsfel behöver mer tester. Se BACKLOG.md för nästa pass.

Ingen kontakt med kunder, inga annonsköp, inga betaltjänster. Inga verkliga kunduppgifter i repot.

### Första leveransens avslut

- GitHub CI och Pages-publicering för första huvudcommitten godkänd: körning `34868949092`.
- Gratis betademo: https://nomarcus.github.io/Experiment/ . Använd kommersiellt lämpad hosting när riktig försäljning ska ske.
- PDF granskad visuellt med Poppler. Fynd: ord delades mitt i vanliga ord och fotorubriken kunde bli ensam på föregående sida. Åtgärdat med ordbaserad radbrytning och separat fotodel, anpassad för två exempelbilder på samma sida. Ny tvåsidig rapport granskad utan klipp/överlapp; de fyra berörda PDF-/offline-browserfallen passerade på nytt.
- Leveransfiler i ursprungsuppgiftens `outputs/`: skärmbilder, exempel-PDF och fristående ZIP. Endast fiktiva uppgifter.
- Nästa pass: börja med BACKLOG.md. Efterfrågan är fortfarande en hypotes. Fokusera på konkret företagsanpassning och driftsäkerhet före fler allmänna funktioner.
