# Surge nasadenie

Produkčná adresa: **https://greatgeargenerator-bucala.surge.sh**

Surge verzia funguje bez Python servera. Analytické výpočty a validácia sú
v TypeScripte, PDF generuje jsPDF a návrhový STEP generuje OpenCascade WebAssembly
cez Replicad v samostatnom Web Worker vlákne. Všetky súbory sa načítavajú z tej
istej Surge domény; nie je potrebný platený backend ani externá CAD služba.

CAD jadro (~23 MB pred kompresiou) sa načíta až pri prvom STEP exporte. Pri pomalom
spojení trvá prvý export dlhšie. Po každom exporte sa worker ukončí a jeho pamäť
uvoľní. Bežný export má limit 120 sekúnd, priestorové zaoblenie hrán 300 sekúnd
(najviac 60 zubov/koleso). Jeho CAD náhľad a STEP používajú spoločné telesá;
úspešný náhľad uchová dočasnú kópiu STEP pre rovnakú geometriu. Chyba načítania sa zobrazí používateľovi a
export sa dá zopakovať. Jednovláknový WASM build nevyžaduje COOP/COEP.

## Automatický deployment z main

Každý push alebo zlúčenie do `main` automaticky spustí **Deploy to Surge**.
Pred publikovaním musia prejsť testy, build, E2E a overenie exportov. Pracovné
vetvy ani pull requesty sa nepublikujú. Ručné opakovanie nasadenia zostáva dostupné:

Otvorte [Deploy to Surge v GitHub Actions](https://github.com/bucala/GreatGearGenerator/actions/workflows/deploy.yml),
kliknite na **Run workflow**, vyberte **main** a spustite ho. Alebo:

```sh
gh workflow run deploy.yml --repo bucala/GreatGearGenerator --ref main
```

Z `frontend` možno použiť aj `npm run deploy:request`. Vyžaduje prihlásený GitHub
CLI; lokálny Surge účet ani build nie sú potrebné. Pracovné vetvy a pull requesty
spúšťajú iba kontroly. Produkčný deployment je automatický po zmene `main`,
prípadne manuálny cez **Run workflow**, vždy iba z vetvy `main`.

Workflow opätovne použije `ci.yml`: testy, build, E2E a overenie exportov. Uloží
otestované `frontend/dist` ako artefakt s názvom obsahujúcim commit SHA. Uloženie
artefaktu riadi explicitný vstup `publish_artifact` pri volaní reusable workflow;
funguje rovnako pri automatickom aj manuálnom spustení. Deploy
job použije tento istý artefakt bez nového zostavenia. Po publikovaní overí
`build-info.json` cez HTTPS, spustí E2E proti produkcii a skontroluje stiahnuté
STEP/PDF cez Python. Súhrn behu obsahuje URL, commit a výsledok; artefakty obsahujú
snímky, exporty a prípadné záznamy zlyhaní.

Nasadenia sú serializované skupinou `surge-production`. Bežiaci deploy sa pri
novom vyžiadaní neruší; GitHub môže nahradiť starší čakajúci beh novším. Pri chybe
pred publikovaním sa produkcia nemení. Pri chybe po publikovaní už nová verzia
môže byť online; workflow zlyhanie oznámi a uloží diagnostiku.

### Prístupový token

GitHub prostredie **surge-production** obsahuje secret **SURGE_TOKEN**. Používa
samostatný Surge token obmedzený na `greatgeargenerator-bucala.surge.sh`.
Secret sa odovzdáva iba kroku kontroly prihlásenia a kroku publikovania, nie
testom ani buildu. Token nikdy nepatrí do repozitára alebo README.

Pri nastavovaní nového repozitára alebo rotácii:

1. V Surge vytvorte token: `surge tokens add --domain greatgeargenerator-bucala.surge.sh -m "GitHub Actions GGG"`.
2. GitHub → Settings → Environments → `surge-production` → Add environment secret → `SURGE_TOKEN`.
3. Vložte token cez súkromné pole nastavení; neuvádzajte ho v príkaze ani v issue.
4. Spustite workflow. Po úspešnom overení nového tokenu odvolajte predchádzajúci
   dedikovaný CI token cez `surge tokens rem <id>`.

Pre neinteraktívne prvotné nastavenie možno token bezpečne odovzdať `gh secret set`
cez stdin. Vytvorenie GitHub prostredia:

```sh
gh api --method PUT repos/bucala/GreatGearGenerator/environments/surge-production
gh secret set SURGE_TOKEN --repo bucala/GreatGearGenerator --env surge-production
```

Surge účet musí mať potvrdený e-mail; prípadnú verifikáciu dokončite cez e-mail od Surge.
GitLab je kópia zdrojov, nie druhý automatický publisher.

### Obnova predchádzajúcej verzie

Na návrat k predošlej funkčnej verzii použite v prihlásenom termináli:

```sh
surge greatgeargenerator-bucala.surge.sh revs
surge greatgeargenerator-bucala.surge.sh rollback
```

Potom spustite overenie proti verejnej adrese podľa sekcie nižšie. Trvalú opravu
urobte v `main` a vyžiadajte nové nasadenie. Automatický rollback sa nevykonáva.

## Lokálne priame publikovanie

V termináli s prihláseným Surge účtom:

```powershell
npm install --global surge
cd C:\GitHub\GreatGearGenerator\frontend
npm ci
npm run deploy:surge
```

Príkaz zostaví a publikuje **iba frontend/dist**. Nepublikujte koreň repozitára,
`backend`, `.venv`, `node_modules` ani skúšobný adresár `lucid-example`.
Surge prihlasovacie údaje nie sú súčasťou projektu.

Čistý frontend vývoj funguje cez `npm run dev`, lokálny náhľad zostavenia cez
`npm run build` / `npm run preview`. Predvolený režim je prehliadačový.

## Voliteľný pôvodný Python backend

Pre použitie serverových endpointov pri zostavovaní nastavte `VITE_RUNTIME=api`:

```powershell
$env:VITE_RUNTIME = 'api'
npm run build
Remove-Item Env:VITE_RUNTIME
```

Takto zostavený frontend potrebuje FastAPI na tej istej doméne. Nie je vhodný pre
samostatný Surge hosting. Vite pri vývoji proxuje `/api` na `127.0.0.1:8000`.

## Overenie

```powershell
npm test
npm run build
npm run test:e2e
cd ..
uv run python scripts/verify_browser_exports.py
```

Playwright spustí obyčajný statický server, otestuje rozhranie a stiahne skutočný
STEP/PDF. Python následne otvorí STEP cez CadQuery, overí dve platné telesá,
otvory, rozmery a objemy a skontroluje obsah PDF. Referenčné matematické testy
porovnávajú prehliadač s výstupmi Python jadra pre sedem prípadov.
Regenerácia dát: `uv run python scripts/generate_browser_fixtures.py`.

Rovnaké E2E možno spustiť proti nasadeniu:

```powershell
cd frontend
$env:TEST_BASE_URL = 'https://greatgeargenerator-bucala.surge.sh'
npm run test:e2e
Remove-Item Env:TEST_BASE_URL
```

Rozsah platnosti geometrie a aproximácií popisuje [ENGINEERING.md](ENGINEERING.md).
