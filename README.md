# Great Gear Generator

Lokálna aplikácia na parametrický návrh vonkajších čelných evolventných súkolesí.
React + TypeScript + Tailwind CSS + React Three Fiber, FastAPI + CadQuery/OpenCASCADE,
PDF reporty cez ReportLab. Rozhranie je v slovenčine, PDF report v angličtine.

## Spustenie vo Windows

Potrebujete **Python 3.13**, **uv**, **Node.js 24** a npm.

```powershell
.\scripts\start.ps1
```

Otvorte **http://127.0.0.1:8000**. Skript nainštaluje uzamknuté závislosti,
zostaví frontend a spustí lokálny server. Pre ukončenie použite Ctrl+C.

Ručné spustenie (Windows aj Linux):

```sh
uv sync --frozen
cd frontend
npm ci
npm run build
cd ..
uv run --frozen python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Pre vývoj spustite backend príkazom vyššie s `--reload` a v druhom termináli
`cd frontend` / `npm run dev`. Vite proxy smeruje `/api` na port 8000.
Backend ponúka OpenAPI dokumentáciu na `/docs`.

## Funkcie

- Modul, počty zubov, uhol záberu, korekcie, šírka a otvory oboch kolies.
- Analytické evolventné rovnice, priemery, korekcia hlavových kružníc,
  pracovná osová vzdialenosť a pracovný uhol záberu.
- Podrezanie, aktívna evolventná interferencia, záberový pomer a hrúbka hlavy.
- Otáčateľný 3D náhľad s animáciou a 2D náčrt s hlavnými rozmermi.
- Odhad Hertzovho napätia a obmedzený Lewisov odhad ohybu v päte.
- PDF s parametrami, rozmermi, výsledkami a rozsahom platnosti.
- Voliteľný **aproximovaný návrhový STEP** obsahujúci obe kolesá a otvory.
- Svetlá/tmavá téma, responzívne rozhranie, validácia a spracovanie chýb.

## Dôležitá odchýlka od návrhu: exaktný STEP

Požiadavka „CadQuery, evolventa bez akejkoľvek B-spline aproximácie a export STEP“
nie je týmto implementovaným postupom splnená. CadQuery `parametricCurve` používa
spline aproximáciu; výsledok preto neoznačujeme ako exaktnú výrobnú geometriu.
Predvolené volanie STEP endpointu skončí 422. Návrhový export sa odomkne len
po explicitnom súhlase s aproximáciou v rozhraní / `allow_approximation: true` v API.

Export interpoluje 65 analyticky vypočítaných bodov na každom boku zuba,
hlavy a päty spája kružnicovými oblúkmi a používa radiálny prechod do päty.
Nemá certifikovanú globálnu hranicu geometrickej odchýlky. Výrobná trochoida,
podrezaná päta, zaoblenie a vôľa nie sú modelované. STEP sa pri nevyhovujúcich
geometrických kontrolách nevygeneruje. Náhľad používa vzorkovanú geometriu.

Výsledok **vyhovuje** sa týka výlučne uvedených predbežných geometrických kontrol.
Nejde o výpočet únosnosti či certifikáciu podľa ISO 6336 / DIN 3990.
Presné rovnice, predpoklady a zdroje sú v [docs/ENGINEERING.md](docs/ENGINEERING.md).

## API

`POST /api/analyze`, `POST /api/generate-report`, `POST /api/generate-step`
prijímajú JSON. Vynechané parametre získajú predvolené hodnoty:

```json
{
  "module": 2, "teeth1": 24, "teeth2": 48, "pressure_angle": 20,
  "profile1": 0, "profile2": 0, "width": 16, "bore1": 10, "bore2": 16,
  "torque": 10, "rpm": 600, "elastic_modulus": 210000, "poisson_ratio": 0.3
}
```

Jednotky: mm, N·m, ot/min, MPa. STEP vyžaduje navyše `allow_approximation: true`.
`GET /api/health` uvádza aj `exact_step: false`.
CAD export je serializovaný; súbežná požiadavka dostane 503. Dočasné súbory sa
po odpovedi odstránia. Aplikácia je určená na lokálne použitie; nemá autentifikáciu.

## Testovanie

```sh
uv sync --frozen --group dev
uv run pytest -q
uv run ruff check backend
uv run ruff format --check backend
cd frontend
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Testy overujú analytické identity, referenčné rozmery, korigovaný prípad KHK,
neplatné vstupy, záťaže, PDF obsah, STEP round-trip cez OpenCASCADE a kompletný
tok v skutočnom prehliadači. E2E automaticky spustí backend a používa zostavený
frontend. Snímky a ukážky exportov vytvorí v ignorovanom adresári `output/`.
GitHub Actions spúšťa rovnaké kontroly na Linuxe.

## Štruktúra

```text
backend/app/       FastAPI, validácia, výpočty, CAD a report
backend/tests/     testy výpočtov a API
frontend/src/      React rozhranie, 2D/3D náhľad a testy vstupov
frontend/e2e/      Playwright testy celej aplikácie
docs/             rovnice a obmedzenia
scripts/          spustenie aplikácie vo Windows
.github/workflows/ automatické kontroly
uv.lock           uzamknuté Python závislosti
```

Python závislosti sú definované v `pyproject.toml` a uzamknuté v `uv.lock`.
`backend/requirements.txt` je export pre alternatívnu inštaláciu cez pip.
Frontend závislosti uzamyká `frontend/package-lock.json`.
