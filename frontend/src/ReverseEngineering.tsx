import { useState } from 'react';
import { ArrowDownToLine, ScanLine } from 'lucide-react';
import { identify, preferredModules, type Identification, type Measurements } from './reverse';
import type { Design } from './types';

const initial = {
  teeth1: '',
  teeth2: '',
  center: '',
  tip1: '',
  root1: '',
  base1: '',
  tip2: '',
  root2: '',
  base2: '',
  tolerance: '0.05',
  pressureAngle: '',
  module: '',
  width: '',
  bore1: '',
  bore2: '',
};
type Values = typeof initial;
const fmt = (v: number, digits = 4) => v.toLocaleString('sk-SK', { maximumFractionDigits: digits });

export default function ReverseEngineering({ onApply }: { onApply: (design: Design) => void }) {
  const [mode, setMode] = useState<'single' | 'pair'>('single');
  const [values, setValues] = useState<Values>(initial);
  const [unshifted, setUnshifted] = useState(false);
  const [result, setResult] = useState<Identification | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  const clear = () => {
    setResult(null);
    setError('');
    setApplied(false);
  };
  const change = (name: keyof Values, value: string) => {
    clear();
    setValues((v) => ({ ...v, [name]: value }));
  };
  const input = (name: keyof Values, label: string, required = false, unit = 'mm') => (
    <div className="field" key={name}>
      <label htmlFor={`reverse-${name}`}>
        {label}
        {required ? ' *' : ''}
      </label>
      <div className="number-wrap">
        <input
          id={`reverse-${name}`}
          type="number"
          step={name.startsWith('teeth') ? '1' : 'any'}
          required={required}
          value={values[name]}
          onChange={(e) => change(name, e.target.value)}
        />
        <span>{unit}</span>
      </div>
    </div>
  );
  const candidate = result?.candidates[selected];
  return (
    <details className="panel reverse-panel">
      <summary>
        <ScanLine size={19} />
        <span>
          Reverzný návrh zo skenu <small>Z nameraných rozmerov na kandidátov ozubenia</small>
        </span>
      </summary>
      <div className="reverse-body">
        <p className="reverse-intro">
          Zadajte skutočne namerané hodnoty. Neznáme rozmery nechajte prázdne. Počet zubov a jeden
          priemer spravidla neurčujú pôvodné ozubenie jednoznačne. Import STL ani automatické
          meranie skenu táto funkcia nerobí.
        </p>
        <div className="mode-tabs" role="group" aria-label="Reverzný návrh – rozsah">
          <button
            type="button"
            aria-pressed={mode === 'single'}
            className={mode === 'single' ? 'active' : ''}
            onClick={() => {
              clear();
              setMode('single');
            }}
          >
            Samostatné koleso
          </button>
          <button
            type="button"
            aria-pressed={mode === 'pair'}
            className={mode === 'pair' ? 'active' : ''}
            onClick={() => {
              clear();
              setMode('pair');
            }}
          >
            Súkolesie so známou vzdialenosťou
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            clear();
            try {
              const numbers = Object.fromEntries(
                Object.entries(values)
                  .filter(([, v]) => v.trim() !== '')
                  .map(([k, v]) => [k, Number(v)]),
              );
              const identification = identify({ ...numbers, mode, unshifted } as Measurements);
              setResult(identification);
              setSelected(0);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Identifikácia zlyhala.');
            }
          }}
        >
          <div className="reverse-input-grid">
            <fieldset>
              <legend>Koleso 1 · namerané rozmery</legend>
              <div className="reverse-fields">
                {input('teeth1', 'Počet zubov 1', true, 'z₁')}
                {input('tip1', 'Vonkajší (hlavový) priemer 1')}
                {input('root1', 'Pätný priemer 1')}
                {input('base1', 'Základný priemer 1 z fitu evolventy')}
                {input('bore1', 'Priemer otvoru 1')}
                {input('width', 'Šírka ozubenia')}
              </div>
            </fieldset>
            {mode === 'pair' && (
              <fieldset>
                <legend>Koleso 2 a osová vzdialenosť</legend>
                <div className="reverse-fields">
                  {input('teeth2', 'Počet zubov 2', true, 'z₂')}
                  {input('center', 'Nominálna osová vzdialenosť', true)}
                  {input('tip2', 'Vonkajší (hlavový) priemer 2')}
                  {input('root2', 'Pätný priemer 2')}
                  {input('base2', 'Základný priemer 2 z fitu evolventy')}
                  {input('bore2', 'Priemer otvoru 2')}
                </div>
                <p className="hint">
                  Osová vzdialenosť je v tomto výpočte pevná. Pre neisté meranie overte osobitne obe
                  krajné hodnoty.
                </p>
              </fieldset>
            )}
            <fieldset>
              <legend>Predpoklady identifikácie</legend>
              <div className="reverse-fields">
                {input('tolerance', 'Tolerancia dₐ / dᶠ / dᵦ ±', true)}
                {input('pressureAngle', 'Známy uhol záberu (inak nechať prázdne)', false, '°')}
                {input('module', 'Známy / neštandardný modul (voliteľné)')}
              </div>
              <label className="approximation reverse-checkbox">
                <input
                  type="checkbox"
                  checked={unshifted}
                  onChange={(e) => {
                    clear();
                    setUnshifted(e.target.checked);
                  }}
                />
                <span>
                  Predpokladať nulovú korekciu {mode === 'pair' ? 'oboch kolies' : 'kolesa'} (x =
                  0).
                </span>
              </label>
              <p className="hint">
                Nezaškrtávajte bez podkladu. Modul bez zadania skúšame zo zoznamu:{' '}
                {preferredModules.join('; ')} mm. Neznámy uhol: 14,5° / 20° / 25° / 30°.
              </p>
            </fieldset>
          </div>
          <div className="reverse-actions">
            <button className="primary" type="submit">
              <ScanLine size={16} /> Nájsť kandidátov
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => {
                clear();
                setMode('single');
                setUnshifted(false);
                setValues({
                  ...initial,
                  teeth1: '24',
                  tip1: '52',
                  root1: '43',
                  pressureAngle: '20',
                  width: '16',
                  bore1: '10',
                });
              }}
            >
              Vyplniť príklad merania
            </button>
          </div>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <section className="reverse-results" aria-label="Výsledok identifikácie">
            <h3>
              {result.candidates.length
                ? `Počet rozmerovo prípustných kandidátov: ${result.candidates.length}`
                : 'Žiadny kandidát v zadanom modeli'}
            </h3>
            <p className="hint">
              {result.candidates.length === 1
                ? 'Jeden kandidát v prehľadávanom zozname nie je dôkazom jedinečnosti pôvodného ozubenia.'
                : result.candidates.length > 1
                  ? 'Merania neurčujú jediný návrh. Vyberte kandidáta a doplňte ďalšie nezávislé meranie.'
                  : 'Skontrolujte druh priemeru, jednotky, neistotu merania, uhol alebo neštandardný modul. Príčinou môže byť aj skrátená hlava, opotrebenie či iný základný hrebeň.'}
            </p>
            {!!result.candidates.length && (
              <>
                <div className="reverse-table-wrap">
                  <table>
                    <caption>Kandidáti podľa RMS odchýlky zadaných priemerov</caption>
                    <thead>
                      <tr>
                        <th>Výber</th>
                        <th>m [mm]</th>
                        <th>α [°]</th>
                        <th>x₁ / x₂</th>
                        <th>Prípustný rozsah x₁</th>
                        <th>RMS [mm]</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.candidates.map((c, i) => (
                        <tr
                          key={`${c.module}-${c.angle}`}
                          className={i === selected ? 'selected' : ''}
                        >
                          <td>
                            <input
                              type="radio"
                              name="reverse-candidate"
                              aria-label={`Kandidát ${i + 1}`}
                              checked={selected === i}
                              onChange={() => {
                                setSelected(i);
                                setApplied(false);
                              }}
                            />
                          </td>
                          <td>{fmt(c.module)}</td>
                          <td>{fmt(c.angle)}</td>
                          <td>
                            {fmt(c.shift1)} / {c.shift2 === null ? '—' : fmt(c.shift2)}
                          </td>
                          <td>
                            {fmt(c.shiftRange[0])} až {fmt(c.shiftRange[1])}
                          </td>
                          <td>{fmt(c.rms, 5)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {candidate && (
                  <div className="reverse-comparison">
                    <h3>Kontrola vybraného kandidáta</h3>
                    <div className="reverse-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Meranie</th>
                            <th>Namerané [mm]</th>
                            <th>Model [mm]</th>
                            <th>Odchýlka [mm]</th>
                          </tr>
                        </thead>
                        <tbody>
                          {candidate.residuals.map((r) => (
                            <tr key={r.label}>
                              <td>{r.label}</td>
                              <td>{fmt(r.measured)}</td>
                              <td>{fmt(r.predicted)}</td>
                              <td>{fmt(r.delta, 5)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="hint">
                      {candidate.undercut
                        ? 'Pozor: predbežné kritérium indikuje riziko podrezania kolesa 1.'
                        : 'Koleso 1 spĺňa orientačné kritérium proti podrezaniu.'}{' '}
                      Rozmerová zhoda neoveruje stav opotrebenia, pevnosť ani výrobné tolerancie.
                    </p>
                    {candidate.transferIssue && (
                      <p className="error">
                        Prenos do existujúceho modelu nie je možný: {candidate.transferIssue}
                      </p>
                    )}
                    <p className="hint">
                      Nezadané otvory budú plné telesá. Nezadaná šírka bude 16 mm. Zaťaženie a
                      materiál sa nastavia na predvolené hodnoty.
                    </p>
                    {mode === 'single' && (
                      <p className="hint">
                        Prenos pridá hypotetické druhé koleso: z₂ = 48, x₂ = −x₁. Ide o podklad na
                        ďalší návrh, nie identifikáciu skutočného súkolesia.
                      </p>
                    )}
                    <button
                      type="button"
                      className="secondary"
                      disabled={!candidate.design}
                      onClick={() => {
                        if (candidate.design) {
                          onApply(candidate.design);
                          setApplied(true);
                        }
                      }}
                    >
                      <ArrowDownToLine size={16} /> Preniesť kandidáta do návrhu
                    </button>
                    {applied && (
                      <p className="reverse-applied" role="status">
                        Kandidát prenesený. Náhľad a geometrické kontroly nájdete nižšie; STEP sa
                        povolí až po ich splnení a potvrdení aproximácie.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="reverse-guidance">
              <h3>Čo ešte zmerať a ako čítať výsledok</h3>
              <p>
                Pre samostatné koleso s nekrátenou hlavou platí m = (dₐ − dᶠ) / 4,5. Ak poznáte len
                dₐ a z, korekcia x zostáva previazaná s modulom. Uhol pomôže overiť fit evolventy
                alebo odborné meranie cez zuby/valčeky; tieto merania tu zatiaľ nemajú vstup.
              </p>
              <ul>
                {result.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </details>
  );
}
