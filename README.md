# Klart — foton till färdig rapport

En svensk app för små serviceföretag som behöver lämna över tydlig arbetsdokumentation till kunden. Foton, anteckningar, branschchecklistor och riktiga PDF-rapporter. Ingen inloggning, extern databas, AI-nyckel eller betald backend.

**[Öppna den fria betademon](https://nomarcus.github.io/Experiment/)** · Välj ”Prova med ett exempel” för att testa direkt.

**Status:** fungerande beta. Betalning är inte aktiverad och betalningsviljan är ännu inte verifierad. Namnet Klart är ett arbetsnamn, inte ett kontrollerat varumärke.

## Kör i Codespaces eller lokalt

Node.js 22 krävs för bygg- och utvecklingskommandon.

```sh
npm ci
npm run build
npm start
```

Öppna `http://localhost:4173`. Codespaces-konfigurationen vidarebefordrar port 4173. Välj **Open in Browser** vid porten. Förhandsvisning inne i en iframe kan begränsa lagring eller nedladdningar: använd då en egen webbläsarflik.

## Fristående drift

Efter `npm run build` innehåller `dist/` hela appen. Lägg den på valfri statisk HTTPS-server. Den behöver inga API:er och inga miljövariabler. PDF-biblioteket ingår lokalt, inga CDN-anrop krävs. Fungerar också under en underkatalog. Appen kräver HTTP/HTTPS, inte dubbelklick via `file://`.

Appen fungerar offline när appfilerna har sparats första gången. På mobiler kan den läggas till på hemskärmen. Installerbarhet och PDF-hantering på fysisk iPhone/Android behöver verifieras separat; mobiltesterna använder Chromium med mobilskärm.

## Funktioner

- Skapa, redigera, söka, filtrera och radera uppdrag.
- Kund, arbetsplats, datum, beskrivning och status.
- Checklistor för service, städning, måleri och trädgård.
- Anpassa checklistan per uppdrag och spara upp till 50 egna mallar. Nya uppdrag får en egen kopia utan avbockningar. Ändringar i en mall påverkar inte tidigare uppdrag.
- Foton från mobil eller fil, bildtext, före/eftermarkering och omordning.
- Lokal automatisk lagring med felstatus och skydd mot samtidig redigering i två flikar när Web Locks finns.
- Företagsuppgifter och egen logotyp, rapportförhandsvisning, PDF-nedladdning och utskrift. Logotyp i PNG/JPG/WebP upp till 5 MB anpassas lokalt och inkluderas i rapporten.
- Komplett JSON-säkerhetskopia, validering och atomisk återställning med bekräftelse.
- Säkerhetskopior i format 3 inkluderar egna mallar och logotyp; äldre format 1 och 2 läses fortfarande in. Format 1 behåller befintliga mallar.
- Illustrerat exempeluppdrag tydligt märkt som exempel.

## Viktiga gränser

Uppgifter sparas i IndexedDB i enhetens webbläsare, **inte i molnet**. Rensning av webbdata kan radera dem. Säkerhetskopian är okrypterad; förvara den säkert. Byte av domän eller webbläsare kräver export/import.

JPG, PNG och WebP stöds. Högst 20 MB per inbild, 100 bilder per uppdrag. Rapportbilder skalas till max 1 600 px och JPG; spara original separat. HEIC saknar stöd. Säkerhetskopior importeras upp till 150 MB och 500 uppdrag. Stora bildmängder behöver ytterligare belastningstest.

PDF-nedladdning använder Helvetica/WinAnsi: svenska och västeuropeiska tecken. För andra alfabet och emoji visar appen ett begripligt fel med hänvisning till **Skriv ut / PDF**, där webbläsaren hanterar tecknen. Rapporten är utförarens uppgifter, inte verifierad besiktning eller digital signering.

## Verifiering

```sh
npm test
npx playwright install chromium
npm run test:e2e
```

Testerna omfattar lagring över omladdning, sökning, säker HTML-rendering, verklig PDF-fil, bildimport/omordning/radering, backup/återställning, ogiltig import, offlinearbete och samtidiga flikar. CI kör på varje push och pull request och levererar en fristående byggartefakt.

## Fortsatt arbete

Se [BACKLOG.md](BACKLOG.md), [WORKLOG.md](WORKLOG.md), [docs/RESEARCH.md](docs/RESEARCH.md) och [docs/LAUNCH.md](docs/LAUNCH.md). Experimentperioden är 14–18 september 2026 med återkommande arbete varannan timme i den ursprungliga Codex-uppgiften.

## Licenser

Appkoden har inte fått någon generell öppen källkodslicens. Offentlig källkod innebär inte automatiskt fri rätt att återdistribuera den. `pdf-lib` distribueras enligt MIT; se [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Inga kundfoton, nycklar eller privata uppgifter ska checkas in.
