import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  Check,
  ChevronRight,
  CircleAlert,
  Cog,
  FileText,
  Layers3,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Ruler,
  Settings2,
  Sun,
} from 'lucide-react';
import { analyze, browserRuntime, download } from './api';
import { defaults, type Analysis, type Design } from './types';
import Sketch from './Sketch';
import ReverseEngineering from './ReverseEngineering';
import { version } from '../package.json';
import ToothDetail from './ToothDetail';

const Scene = lazy(() => import('./Scene'));
type Draft = Record<keyof Design, string>;
const initialDraft = Object.fromEntries(
  Object.entries(defaults).map(([k, v]) => [k, String(v)]),
) as Draft;
const fmt = (v: number, digits = 2) =>
  v.toLocaleString('sk-SK', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function parseDraft(draft: Draft): Design | null {
  const active = { ...draft };
  for (const kind of ['root', 'tip', 'face'] as const)
    if (draft.manual_radii !== '1' || draft[`${kind}_fillet`] !== '1')
      active[`${kind}_radius`] = '0';
  if (Object.values(active).some((v) => v.trim() === '' || !Number.isFinite(Number(v))))
    return null;
  return Object.fromEntries(Object.entries(active).map(([k, v]) => [k, Number(v)])) as Design;
}

class ViewerBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="viewer-message">
        3D nie je dostupné v tomto prehliadači. Použite 2D náčrt.
      </div>
    ) : (
      this.props.children
    );
  }
}

function Field({
  name,
  label,
  symbol,
  unit,
  min,
  max,
  step = 1,
  draft,
  set,
  slider = false,
  disabled = false,
}: {
  name: keyof Design;
  label: string;
  symbol: string;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  draft: Draft;
  set: (key: keyof Design, value: string) => void;
  slider?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>
        {label} <span className="symbol">{symbol}</span>
      </label>
      <div className="number-wrap">
        <input
          id={name}
          type="number"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={draft[name]}
          onChange={(e) => set(name, e.target.value)}
        />
        <span>{unit ?? '—'}</span>
      </div>
      {slider && (
        <input
          className="slider"
          aria-label={`${label} – posuvník`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={draft[name] || min}
          onChange={(e) => set(name, e.target.value)}
        />
      )}
    </div>
  );
}

export default function App() {
  const [workflow, setWorkflow] = useState<'reverse' | 'design'>('reverse');
  const [identifiedModule, setIdentifiedModule] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [busy, setBusy] = useState('');
  const [cadBusy, setCadBusy] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [mode, setMode] = useState<'3d' | '2d'>('3d');
  const [animate, setAnimate] = useState(false);
  const [approximate, setApproximate] = useState(false);
  const [light, setLight] = useState(() => localStorage.getItem('ggg-theme') === 'light');
  const design = useMemo(() => parseDraft(draft), [draft]);
  const fresh =
    !!result && !!design && JSON.stringify(result.parameters) === JSON.stringify(design);
  const set = (key: keyof Design, value: string) => {
    setIdentifiedModule(null);
    setDraft((d) => ({
      ...d,
      [key]: value,
      ...(key === 'face_fillet' && value === '1' ? { root_fillet: '1', tip_fillet: '1' } : {}),
      ...((key === 'root_fillet' || key === 'tip_fillet') && value === '0'
        ? { face_fillet: '0' }
        : {}),
    }));
  };

  useEffect(() => {
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    localStorage.setItem('ggg-theme', light ? 'light' : 'dark');
  }, [light]);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setExportError('');
    if (!design) {
      setResult(null);
      setError('Vyplňte všetky parametre platnými číslami.');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await analyze(design, controller.signal);
        if (!controller.signal.aborted) setResult(data);
      } catch (e) {
        if (!controller.signal.aborted) {
          setResult(null);
          setError(e instanceof Error ? e.message : 'Spojenie so serverom zlyhalo.');
        }
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [design]);

  async function exportFile(kind: 'step' | 'report') {
    if (!fresh || busy || !design) return;
    setBusy(kind);
    setExportProgress('');
    setExportError('');
    try {
      await download(kind, design, approximate, setExportProgress);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export zlyhal.');
    } finally {
      setBusy('');
    }
  }

  const f = (props: Omit<Parameters<typeof Field>[0], 'draft' | 'set'>) => (
    <Field {...props} draft={draft} set={set} />
  );
  return (
    <div className="app">
      <header className="topbar">
        <a href="#" className="brand">
          <span className="brand-icon">
            <Cog size={25} />
          </span>
          <span>
            Great Gear<span className="brand-sub">GENERATOR</span>
          </span>
        </a>
        <div className="top-middle">
          <span className="tiny-dot" /> Engineering workspace{' '}
          <span className="version">v{version}</span>
        </div>
        <div className="topbar-actions">
          {workflow === 'design' && (
            <button
              className="secondary reset"
              aria-label="Obnoviť návrh"
              onClick={() => {
                setDraft(initialDraft);
                setApproximate(false);
                setAnimate(false);
                setIdentifiedModule(null);
              }}
            >
              <RotateCcw size={15} /> <span>Obnoviť návrh</span>
            </button>
          )}
          <button
            className="icon-button"
            onClick={() => setLight(!light)}
            aria-label={light ? 'Zapnúť tmavú tému' : 'Zapnúť svetlú tému'}
          >
            {light ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>
      {workflow === 'reverse' && (
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              NÁVRH PREVODOV <ChevronRight size={12} /> ČELNÉ OZUBENIE
            </div>
            <h1>
              Od merania k ozubeniu
              <span>.</span>
            </h1>
            <p>Modul nemusíte poznať. Hľadáme ho z rozmerov reálneho kolesa.</p>
          </div>
        </div>
      )}
      <div className="workflow-tabs mode-tabs" role="group" aria-label="Spôsob návrhu">
        <button
          type="button"
          aria-pressed={workflow === 'reverse'}
          className={workflow === 'reverse' ? 'active' : ''}
          onClick={() => setWorkflow('reverse')}
        >
          Z nameraného kusu
        </button>
        <button
          type="button"
          aria-pressed={workflow === 'design'}
          className={workflow === 'design' ? 'active' : ''}
          onClick={() => setWorkflow('design')}
        >
          Návrh z parametrov
        </button>
      </div>
      {workflow === 'design' && identifiedModule !== null && (
        <p className="identified-module" role="status">
          Prenesený kandidát: modul m = {fmt(identifiedModule, 4)} mm. Hodnota pochádza z
          identifikácie; overte aj ostatné geometrické kontroly.
        </p>
      )}
      <div hidden={workflow !== 'reverse'}>
        <ReverseEngineering
          onApply={(design) => {
            setDraft(
              Object.fromEntries(Object.entries(design).map(([k, v]) => [k, String(v)])) as Draft,
            );
            setApproximate(false);
            setAnimate(false);
            setIdentifiedModule(design.module);
            setWorkflow('design');
          }}
        />
      </div>
      {workflow === 'design' && (
        <main className="workspace">
          <aside className="panel parameters">
            <div className="panel-title">
              <Settings2 size={17} />
              <h2>Parametre návrhu</h2>
              <span className="tag">mm</span>
            </div>

            <div className="section-label">
              <span>01</span> ZÁKLADNÁ GEOMETRIA
            </div>
            <div className="fields">
              {f({
                name: 'module',
                label: 'Modul',
                symbol: 'm',
                unit: 'mm',
                min: 0.2,
                max: 10,
                step: 0.1,
                slider: true,
              })}
              <div className="two-col">
                {f({
                  name: 'pressure_angle',
                  label: 'Uhol záberu',
                  symbol: 'α',
                  unit: '°',
                  min: 14.5,
                  max: 30,
                  step: 0.5,
                })}
                {f({
                  name: 'width',
                  label: 'Šírka ozubenia',
                  symbol: 'b',
                  unit: 'mm',
                  min: 1,
                  max: 100,
                  step: 0.5,
                })}
              </div>
            </div>
            <div className="gear-label">
              <span className="swatch amber" />
              <h3>Pastorok</h3>
              <span>HNACÍ ČLEN</span>
            </div>
            <div className="fields">
              {f({
                name: 'teeth1',
                label: 'Počet zubov',
                symbol: 'z₁',
                min: 8,
                max: 120,
                slider: true,
              })}
              <div className="two-col">
                {f({
                  name: 'profile1',
                  label: 'Korekcia',
                  symbol: 'x₁',
                  min: -0.5,
                  max: 0.8,
                  step: 0.05,
                })}
                {f({
                  name: 'bore1',
                  label: 'Otvor',
                  symbol: 'Ø',
                  unit: 'mm',
                  min: 0,
                  max: 300,
                  step: 0.5,
                })}
              </div>
            </div>
            <div className="gear-label">
              <span className="swatch teal" />
              <h3>Koleso</h3>
              <span>HNANÝ ČLEN</span>
            </div>
            <div className="fields">
              {f({
                name: 'teeth2',
                label: 'Počet zubov',
                symbol: 'z₂',
                min: 8,
                max: 120,
                slider: true,
              })}
              <div className="two-col">
                {f({
                  name: 'profile2',
                  label: 'Korekcia',
                  symbol: 'x₂',
                  min: -0.5,
                  max: 0.8,
                  step: 0.05,
                })}
                {f({
                  name: 'bore2',
                  label: 'Otvor',
                  symbol: 'Ø',
                  unit: 'mm',
                  min: 0,
                  max: 300,
                  step: 0.5,
                })}
              </div>
            </div>
            <fieldset className="model-selection">
              <legend>Zaoblenia modelu</legend>
              <label>
                <input
                  type="radio"
                  name="root-model"
                  checked={draft.root_fillet === '0'}
                  onChange={() => set('root_fillet', '0')}
                />{' '}
                Bez zaoblenia päty
              </label>
              <label>
                <input
                  type="radio"
                  name="root-model"
                  checked={draft.root_fillet === '1'}
                  onChange={() => set('root_fillet', '1')}
                />{' '}
                {draft.manual_radii === '1' ? 'So zaoblením päty' : 'S navrhovaným zaoblením päty'}
              </label>
              <p className="hint">
                {draft.manual_radii === '1'
                  ? 'Kruhový prechod v päte s ručne zadaným R.'
                  : 'Kruhový prechod v päte, návrh R ≤ 0,3 m.'}
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={draft.tip_fillet === '1'}
                  onChange={(e) => set('tip_fillet', e.target.checked ? '1' : '0')}
                />{' '}
                Zaobliť hlavu zuba
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.face_fillet === '1'}
                  onChange={(e) => set('face_fillet', e.target.checked ? '1' : '0')}
                />{' '}
                Zaobliť hrany po šírke
              </label>
              <p className="hint">
                Hrany po šírke zapnú aj prechody päty a hlavy pre súvislý CAD obrys. 3D náhľad potom
                počíta CAD jadro; môže trvať dlhšie. Najviac 60 zubov na koleso.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={draft.manual_radii === '1'}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIdentifiedModule(null);
                    setDraft((d) => {
                      const seed = (kind: 'root' | 'tip' | 'face', coefficient: number) => {
                        const saved = d[`${kind}_radius`];
                        if (Number(saved) > 0) return saved;
                        const proposed = fresh
                          ? result.gears
                              .map((g) =>
                                kind === 'face'
                                  ? g.face_radius
                                  : (g[`${kind}_fillet`]?.radius ?? 0),
                              )
                              .filter((r) => r > 0)
                          : [];
                        return String(
                          proposed.length
                            ? Math.min(...proposed)
                            : coefficient * (Number(d.module) || 2),
                        );
                      };
                      return {
                        ...d,
                        manual_radii: checked ? '1' : '0',
                        ...(checked
                          ? {
                              root_radius: seed('root', 0.3),
                              tip_radius: seed('tip', 0.1),
                              face_radius: seed('face', 0.05),
                            }
                          : {}),
                      };
                    });
                  }}
                />{' '}
                Ručne zadať rádiusy
              </label>
              {draft.manual_radii === '1' && (
                <div className="manual-radii">
                  <p className="hint">
                    Hodnoty v mm platia pre obe kolesá a použijú sa pre zapnuté zaoblenia. Neplatný
                    rádus sa automaticky nezmenší.
                  </p>
                  {(['root', 'tip', 'face'] as const).map((kind, index) => (
                    <Field
                      key={kind}
                      name={`${kind}_radius`}
                      label={['Rádus päty', 'Rádus hlavy', 'Rádus hrán po šírke'][index]}
                      symbol="R"
                      unit="mm"
                      min={0.000001}
                      max={100}
                      step={0.01}
                      draft={draft}
                      set={set}
                      disabled={draft[`${kind}_fillet`] !== '1'}
                    />
                  ))}
                </div>
              )}
              {fresh && (
                <p className="hint">
                  R₁ = {fmt(result.gears[0].root_fillet?.radius ?? 0, 3)} mm · R₂ ={' '}
                  {fmt(result.gears[1].root_fillet?.radius ?? 0, 3)} mm
                  <br />R hlavy:{' '}
                  {result.gears.map((g) => fmt(g.tip_fillet?.radius ?? 0, 3)).join(' / ')} mm
                  <br />R hrán po šírke:{' '}
                  {result.gears.map((g) => fmt(g.face_radius, 3)).join(' / ')} mm
                </p>
              )}
            </fieldset>
            <details className="loads">
              <summary>
                <Activity size={15} /> Zaťaženie a materiál <ChevronRight size={14} />
              </summary>
              <div className="fields two-col">
                {f({
                  name: 'torque',
                  label: 'Moment',
                  symbol: 'T₁',
                  unit: 'N·m',
                  min: 0,
                  max: 10000,
                  step: 0.1,
                })}
                {f({
                  name: 'rpm',
                  label: 'Otáčky',
                  symbol: 'n₁',
                  unit: 'min⁻¹',
                  min: 0,
                  max: 30000,
                })}
                {f({
                  name: 'elastic_modulus',
                  label: 'Modul pružnosti',
                  symbol: 'E',
                  unit: 'MPa',
                  min: 100,
                  max: 500000,
                })}
                {f({
                  name: 'poisson_ratio',
                  label: 'Poissonovo číslo',
                  symbol: 'ν',
                  min: 0,
                  max: 0.49,
                  step: 0.01,
                })}
              </div>
              <p className="hint">
                Rovnaký materiál oboch kolies. Predvolené hodnoty zodpovedajú oceli.
              </p>
            </details>
          </aside>
          <section className="center-column">
            <div className="panel viewer-panel">
              <div className="viewer-toolbar">
                <div className="mode-tabs" role="group" aria-label="Režim náhľadu">
                  <button className={mode === '3d' ? 'active' : ''} onClick={() => setMode('3d')}>
                    <Box size={15} /> 3D model
                  </button>
                  <button className={mode === '2d' ? 'active' : ''} onClick={() => setMode('2d')}>
                    <Ruler size={15} /> 2D náčrt
                  </button>
                </div>
                <span className="viewer-tag">
                  <span className="tiny-dot" /> NÁVRHOVÝ NÁHĽAD
                </span>
              </div>
              <div className="viewer">
                {result && (
                  <>
                    {mode === '2d' ? (
                      <Sketch result={result} animate={animate && fresh} interactive={fresh} />
                    ) : (
                      <ViewerBoundary>
                        <Suspense
                          fallback={<div className="viewer-message">Načítavam 3D náhľad…</div>}
                        >
                          <Scene
                            result={result}
                            animate={animate && fresh}
                            interactive={fresh && !cadBusy}
                            onCadBusy={setCadBusy}
                          />
                        </Suspense>
                      </ViewerBoundary>
                    )}
                  </>
                )}
                {!fresh && (
                  <div
                    className={`viewer-message overlay ${error ? 'has-error' : ''}`}
                    role="status"
                    aria-label="Stav výpočtu"
                  >
                    {error || 'Prepočítavam geometriu…'}
                  </div>
                )}
                <div className="viewer-corner">
                  <span className="crosshair">＋</span> XY / mm
                </div>
                {result && (
                  <button
                    type="button"
                    className="viewer-control animate-button"
                    disabled={!fresh || (mode === '3d' && cadBusy)}
                    onClick={() => setAnimate(!animate)}
                    aria-pressed={animate}
                  >
                    {animate ? <Pause size={15} /> : <Play size={15} />}
                    {animate ? 'Pozastaviť otáčanie' : 'Spustiť otáčanie'}
                  </button>
                )}
              </div>
              <div className="viewer-footer">
                <div>
                  <span className="swatch amber" /> Pastorok <span className="swatch teal" /> Koleso
                </div>
                <span>
                  {mode === '3d'
                    ? 'Ťahanie: otáčanie · Koliesko: priblíženie'
                    : 'Ťahanie: posun · Koliesko: priblíženie · Čiarkovaná: rozstupová · Bodkovaná: základná'}
                </span>
              </div>
            </div>
            {fresh && result && <ToothDetail result={result} />}
            <div className="metrics">
              <div className="panel metric">
                <span>
                  PREVODOVÝ POMER <ArrowUpRight size={14} />
                </span>
                <strong>
                  {fresh ? fmt(result.ratio) : '—'}
                  <small> : 1</small>
                </strong>
                <p>i = z₂ / z₁</p>
              </div>
              <div className="panel metric">
                <span>
                  OSOVÁ VZDIALENOSŤ <Ruler size={14} />
                </span>
                <strong>
                  {fresh ? fmt(result.center_distance) : '—'}
                  <small> mm</small>
                </strong>
                <p>Pracovná vzdialenosť osí</p>
              </div>
              <div className="panel metric">
                <span>
                  SÚČINITEĽ ZÁBERU <Layers3 size={14} />
                </span>
                <strong>
                  {fresh ? fmt(result.contact_ratio, 3) : '—'}
                  <small> εα</small>
                </strong>
                <p>Čelný záberový pomer</p>
              </div>
            </div>
            <div className="panel dimensions">
              <div className="panel-title">
                <Ruler size={17} />
                <h2>Geometrické rozmery</h2>
                <span className="muted">Všetky rozmery v mm</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Priemer</th>
                    <th>
                      <span className="swatch amber" /> Pastorok
                    </th>
                    <th>
                      <span className="swatch teal" /> Koleso
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['Rozstupový', 'd', 'pitch_diameter'],
                      ['Základný', 'dᵦ', 'base_diameter'],
                      ['Hlavový', 'dₐ', 'tip_diameter'],
                      ['Pätný', 'dᶠ', 'root_diameter'],
                    ] as const
                  ).map(([label, symbol, key]) => (
                    <tr key={key}>
                      <td>
                        {label} <span className="symbol">{symbol}</span>
                      </td>
                      {[0, 1].map((i) => (
                        <td key={i}>{fresh ? fmt(result.gears[i][key], 3) : '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="right-column">
            <div className="panel analysis">
              <div className="panel-title">
                <Activity size={17} />
                <h2>Analýza návrhu</h2>
              </div>
              <div className={`status-card ${fresh && result.geometry_ok ? 'pass' : 'attention'}`}>
                {fresh && result.geometry_ok ? <Check size={22} /> : <CircleAlert size={22} />}
                <div>
                  <strong>
                    {!fresh
                      ? 'Čaká na výpočet'
                      : result.geometry_ok
                        ? 'Geometrické kontroly vyhovujú'
                        : 'Návrh vyžaduje úpravu'}
                  </strong>
                  <p>Predbežné overenie geometrie</p>
                </div>
              </div>
              <div className="checks">
                {fresh &&
                  result.checks.map((c) => (
                    <div className="check-row" key={c.name}>
                      {c.ok ? (
                        <Check size={15} className="success" />
                      ) : (
                        <CircleAlert size={15} className="warning" />
                      )}
                      <div>
                        <strong>{c.name}</strong>
                        <span>{c.detail}</span>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="stress">
                {fresh && !!result.parameters.face_fillet && (
                  <p className="hint">
                    Pre odhad napätia: nezaoblená šírka b_eff = {fmt(result.effective_width, 3)} mm.
                  </p>
                )}
                <div className="section-label">
                  <span>02</span> ODHAD ZAŤAŽENIA
                </div>
                <div>
                  <span>Hertzovo napätie</span>
                  <strong>
                    {fresh ? fmt(result.hertz_mpa, 1) : '—'} <small>MPa</small>
                  </strong>
                </div>
                <div>
                  <span>Ohyb v päte zuba 1 / 2</span>
                  <strong>
                    {fresh && result.bending_mpa
                      ? result.bending_mpa.map((v) => fmt(v, 1)).join(' / ')
                      : '—'}{' '}
                    <small>MPa</small>
                  </strong>
                </div>
                {fresh && !result.bending_mpa && (
                  <p className="hint">
                    Lewisov odhad je dostupný pre nekorigované ozubenie s uhlom 20°.
                  </p>
                )}
                <div>
                  <span>Výstupné otáčky</span>
                  <strong>
                    {fresh ? fmt(result.output_rpm, 0) : '—'} <small>min⁻¹</small>
                  </strong>
                </div>
              </div>
              <p className="analysis-note">
                <CircleAlert size={14} /> Výpočty sú orientačné. Nezahŕňajú únavu, dynamiku ani
                bezpečnostné súčinitele podľa ISO 6336 / DIN 3990.
              </p>
            </div>
            <div className="panel exports">
              <div className="panel-title">
                <ArrowDownToLine size={17} />
                <h2>Export návrhu</h2>
              </div>
              <p>Model pre ďalšiu prácu. Správa pre váš výpočtový archív.</p>
              <label className="approximation">
                <input
                  type="checkbox"
                  checked={approximate}
                  onChange={(e) => setApproximate(e.target.checked)}
                />
                <span>Povoliť návrhový STEP s B-spline aproximáciou a zvoleným modelom päty.</span>
              </label>
              <button
                className="primary"
                disabled={!fresh || !result.geometry_ok || !approximate || !!busy || cadBusy}
                onClick={() => exportFile('step')}
              >
                <Box size={17} />
                {busy === 'step'
                  ? exportProgress || 'Generujem STEP…'
                  : cadBusy
                    ? 'Počítam 3D zaoblenia…'
                    : 'Stiahnuť STEP'}
                <span>.stp</span>
              </button>
              <button
                className="secondary"
                disabled={!fresh || !!busy}
                onClick={() => exportFile('report')}
              >
                <FileText size={17} />
                {busy === 'report' ? 'Generujem PDF…' : 'Výpočtová správa'}
                <span>.pdf</span>
              </button>
              <p className="hint">
                Exaktný STEP bez aproximácie nie je podporovaný. Náhľad ani export nemodelujú
                výrobnú trochoidu; kruhové zaoblenie je navrhovaná konštrukčná úprava.
              </p>
              {exportError && (
                <p className="error" role="alert">
                  {exportError}
                </p>
              )}
            </div>
          </aside>
        </main>
      )}
      <footer className="page-footer">
        <span>
          <Cog size={13} /> GREAT GEAR GENERATOR
        </span>
        <span>Čelné evolventné súkolesie · Predbežný inžiniersky návrh</span>
        <span className="local-label">
          <span className="tiny-dot" />{' '}
          {browserRuntime ? 'Výpočet v prehliadači' : 'Lokálny výpočet'}
        </span>
      </footer>
    </div>
  );
}
