/** Inverse identification under the same rack assumptions as geometry.ts.
 * Candidate intervals are conditional on m, alpha and nominal center distance.
 * They are not statistical confidence intervals or a certification of a scan.
 */
import { calculate } from './geometry';
import { defaults, type Design } from './types';

export const preferredModules = [
  0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10,
];
export type Measurements = {
  mode: 'single' | 'pair';
  teeth1: number;
  teeth2?: number;
  center?: number;
  tip1?: number;
  root1?: number;
  base1?: number;
  tip2?: number;
  root2?: number;
  base2?: number;
  tolerance: number;
  pressureAngle?: number;
  module?: number;
  unshifted: boolean;
  width?: number;
  bore1?: number;
  bore2?: number;
};
export type Residual = { label: string; measured: number; predicted: number; delta: number };
export type Candidate = {
  module: number;
  angle: number;
  shift1: number;
  shift2: number | null;
  shiftRange: [number, number];
  rms: number;
  residuals: Residual[];
  design: Design | null;
  transferIssue: string;
  undercut: boolean;
};
export type Identification = { candidates: Candidate[]; notes: string[] };
const rad = (a: number) => (a * Math.PI) / 180;
const inv = (a: number) => Math.tan(a) - a;
const diameterKeys = ['tip1', 'root1', 'base1', 'tip2', 'root2', 'base2'] as const;

function bounded(
  value: number | undefined,
  lo: number,
  hi: number,
  label: string,
  integer = false,
) {
  if (
    value === undefined ||
    !Number.isFinite(value) ||
    value < lo ||
    value > hi ||
    (integer && !Number.isInteger(value))
  )
    throw new Error(`${label}: zadajte ${integer ? 'celé číslo' : 'hodnotu'} od ${lo} do ${hi}.`);
}

export function identify(p: Measurements): Identification {
  if (p.mode !== 'single' && p.mode !== 'pair') throw new Error('Neznámy režim identifikácie.');
  bounded(p.teeth1, 8, 120, 'Počet zubov 1', true);
  bounded(p.tolerance, 0.0001, 5, 'Tolerancia priemerov');
  if (p.pressureAngle !== undefined) bounded(p.pressureAngle, 14.5, 30, 'Uhol záberu');
  if (p.module !== undefined) bounded(p.module, 0.2, 10, 'Modul');
  if (p.width !== undefined) bounded(p.width, 1, 100, 'Šírka');
  for (const key of ['bore1', 'bore2'] as const)
    if (p[key] !== undefined) bounded(p[key], 0, 300, 'Otvor');
  if (p.mode === 'pair') {
    bounded(p.teeth2, 8, 120, 'Počet zubov 2', true);
    bounded(p.center, 0.01, 1500, 'Osová vzdialenosť');
  }
  const keys = p.mode === 'pair' ? diameterKeys : diameterKeys.slice(0, 3);
  for (const key of keys) if (p[key] !== undefined) bounded(p[key], 0.01, 1500, key);
  if (!keys.some((key) => p[key] !== undefined))
    throw new Error('Zadajte aspoň jeden nameraný priemer.');
  for (const i of p.mode === 'pair' ? ([1, 2] as const) : ([1] as const)) {
    const tip = p[`tip${i}`],
      root = p[`root${i}`];
    if (tip !== undefined && root !== undefined && tip <= root)
      throw new Error('Hlavový priemer musí byť väčší než pätný priemer.');
  }
  const notes = [
    'Výsledky platia pre vonkajšie čelné evolventné ozubenie: ha*=1, hf*=1,25, bez vôle a výrobnej úpravy hlavy. Opotrebenie, odchýlka skenu a iný nástroj môžu výsledok zmeniť.',
    'Uvedené rozsahy korekcie vyjadrujú prípustnosť nameraných priemerov v zadanej tolerancii, nie štatistickú spoľahlivosť. Poradie podľa odchýlky nedokazuje pôvodný návrh.',
  ];
  if (p.module === undefined)
    notes.push(
      'Hľadáme iba v uvedenom zozname preferovaných modulov 0,2–10 mm. Neštandardný alebo palcový modul zadajte ručne.',
    );
  if (p.pressureAngle === undefined)
    notes.push(
      'Neznámy uhol: testujeme iba 14,5°, 20°, 25° a 30°. Z vonkajšieho a pätného priemeru samostatného kolesa uhol nezistíme.',
    );
  if (p.mode === 'single')
    notes.push(
      'Samostatné koleso: predpokladáme nulové skrátenie hlavy. Pri prenose do súkolesia sa doplní hypotetické druhé koleso s 48 zubmi a opačnou korekciou (x₂=−x₁); toto druhé koleso nebolo identifikované.',
    );
  else
    notes.push(
      'Osová vzdialenosť je pevná nominálna hodnota modelu. Jej neistota sa nepropaguje: zopakujte výpočet pre krajné namerané vzdialenosti. Tolerancia ± sa vzťahuje iba na priemery.',
    );
  if (p.base1 !== undefined || (p.mode === 'pair' && p.base2 !== undefined))
    notes.push(
      'Základná kružnica nie je hranica päty zuba. Jej priemer zadávajte iba ak bol spoľahlivo určený z fitu evolventy.',
    );
  const candidates: Candidate[] = [];
  for (const m of p.module === undefined ? preferredModules : [p.module]) {
    for (const angle of p.pressureAngle === undefined ? [14.5, 20, 25, 30] : [p.pressureAngle]) {
      const a = rad(angle),
        z2 = p.mode === 'pair' ? p.teeth2! : 48;
      let sum = 0,
        k = 0;
      if (p.mode === 'pair') {
        const reference = (m * (p.teeth1 + z2)) / 2;
        const cosine = (reference * Math.cos(a)) / p.center!;
        if (cosine <= 0 || cosine >= 1) continue;
        const working = Math.acos(cosine);
        sum = ((inv(working) - inv(a)) * (p.teeth1 + z2)) / (2 * Math.tan(a));
        k = sum - (p.center! - reference) / m;
      }
      if (p.unshifted && Math.abs(sum) > 1e-8) continue;
      let lo = p.unshifted ? 0 : -0.5,
        hi = p.unshifted ? 0 : 0.8;
      if (p.mode === 'pair') {
        lo = Math.max(lo, sum - 0.8);
        hi = Math.min(hi, sum + 0.5);
      }
      const equations: { label: string; measured: number; offset: number; slope: number }[] = [];
      for (const i of p.mode === 'pair' ? ([1, 2] as const) : ([1] as const)) {
        const z = i === 1 ? p.teeth1 : z2,
          shift = i === 1 ? 0 : sum,
          slope = i === 1 ? 2 * m : -2 * m;
        for (const [key, label, offset, coefficient] of [
          [`tip${i}`, `Hlavový priemer ${i}`, m * (z + 2 + 2 * shift - 2 * k), slope],
          [`root${i}`, `Pätný priemer ${i}`, m * (z - 2.5 + 2 * shift), slope],
          [`base${i}`, `Základný priemer ${i}`, m * z * Math.cos(a), 0],
        ] as const) {
          const measured = p[key];
          if (measured === undefined) continue;
          equations.push({ label, measured, offset, slope: coefficient });
          if (coefficient === 0) {
            if (Math.abs(offset - measured) > p.tolerance + 1e-9) {
              lo = 1;
              hi = 0;
            }
          } else {
            const ends = [
              (measured - p.tolerance - offset) / coefficient,
              (measured + p.tolerance - offset) / coefficient,
            ];
            lo = Math.max(lo, Math.min(...ends));
            hi = Math.min(hi, Math.max(...ends));
          }
        }
      }
      if (lo > hi + 1e-9) continue;
      // Clamp the least-squares solution to the intersection of measurement intervals.
      if (lo > hi) lo = hi;
      const weight = equations.reduce((s, e) => s + e.slope ** 2, 0);
      const estimate = weight
        ? equations.reduce((s, e) => s + e.slope * (e.measured - e.offset), 0) / weight
        : 0;
      const x1 = Math.max(lo, Math.min(hi, estimate));
      const x2 = sum - x1;
      const residuals = equations.map((e) => ({
        label: e.label,
        measured: e.measured,
        predicted: e.offset + e.slope * x1,
        delta: e.offset + e.slope * x1 - e.measured,
      }));
      // Do not imply that a dimensional fit also passed the forward geometry checks.
      let design: Design | null = {
        ...defaults,
        module: m,
        pressure_angle: angle,
        teeth1: p.teeth1,
        teeth2: z2,
        profile1: x1,
        profile2: x2,
        width: p.width ?? defaults.width,
        bore1: p.bore1 ?? 0,
        bore2: p.mode === 'pair' ? (p.bore2 ?? 0) : 0,
      };
      let transferIssue = '';
      try {
        calculate(design);
      } catch (error) {
        transferIssue = error instanceof Error ? error.message : 'Model sa nedá preniesť.';
        design = null;
      }
      candidates.push({
        module: m,
        angle,
        shift1: x1,
        shift2: p.mode === 'pair' ? x2 : null,
        shiftRange: [lo, hi],
        rms: Math.sqrt(residuals.reduce((s, r) => s + r.delta ** 2, 0) / residuals.length),
        residuals,
        design,
        transferIssue,
        undercut: p.teeth1 < (2 * (1 - x1)) / Math.sin(a) ** 2 - 1e-10,
      });
    }
  }
  candidates.sort(
    (a, b) =>
      a.rms - b.rms ||
      Math.abs(a.shift1) - Math.abs(b.shift1) ||
      a.angle - b.angle ||
      a.module - b.module,
  );
  return { candidates, notes };
}
