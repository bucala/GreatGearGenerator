# Surge nasadenie

Produkčná adresa: **https://greatgeargenerator-bucala.surge.sh**

Surge verzia funguje bez Python servera. Analytické výpočty a validácia sú
v TypeScripte, PDF generuje jsPDF a návrhový STEP generuje OpenCascade WebAssembly
cez Replicad v samostatnom Web Worker vlákne. Všetky súbory sa načítavajú z tej
istej Surge domény; nie je potrebný platený backend ani externá CAD služba.

CAD jadro (~23 MB pred kompresiou) sa načíta až pri prvom STEP exporte. Pri pomalom
spojení trvá prvý export dlhšie. Po každom exporte sa worker ukončí a jeho pamäť
uvoľní. Limit exportu je 120 sekúnd. Chyba načítania sa zobrazí používateľovi a
export sa dá zopakovať. Jednovláknový WASM build nevyžaduje COOP/COEP.

## Publikovanie

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
