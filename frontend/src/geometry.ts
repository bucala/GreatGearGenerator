/** Browser counterpart of backend/app/geometry.py. Units: mm, N, MPa and N m.
 * Keep the Python reference fixtures in sync when changing these equations.
 * See docs/ENGINEERING.md for the scope of these preliminary calculations.
 */
import type { Analysis, Design, Gear } from './types';
import { proposeRootFillet, proposeTipFillet, roundedOutline } from './profile';

const { PI, sin, cos, tan, atan, sqrt, max, hypot, abs } = Math;
const radians = (angle: number) => (angle * PI) / 180;
const inv = (angle: number) => tan(angle) - angle;
export type Point2 = [number, number];
export const polar = (radius: number, angle: number): Point2 => [
  radius * cos(angle),
  radius * sin(angle),
];

const bounds: Record<keyof Design, [number, number]> = {
  root_fillet: [0, 1],
  tip_fillet: [0, 1],
  face_fillet: [0, 1],
  module: [0.2, 10],
  teeth1: [8, 120],
  teeth2: [8, 120],
  pressure_angle: [14.5, 30],
  profile1: [-0.5, 0.8],
  profile2: [-0.5, 0.8],
  width: [1, 100],
  bore1: [0, 300],
  bore2: [0, 300],
  torque: [0, 10000],
  rpm: [0, 30000],
  elastic_modulus: [100, 500000],
  poisson_ratio: [0, 0.49],
};

export function validate(p: Design) {
  if (p.face_fillet && Math.max(p.teeth1, p.teeth2) > 60)
    throw new Error('Zaoblenie hrán po šírke podporuje najviac 60 zubov na koleso.');
  if (p.face_fillet && (!p.root_fillet || !p.tip_fillet))
    throw new Error('Zaoblenie hrán po šírke vyžaduje zapnuté prechody päty aj hlavy.');
  for (const key of Object.keys(bounds) as (keyof Design)[]) {
    const [lo, hi] = bounds[key];
    const value = key.endsWith('_fillet') ? (p[key] ?? 0) : p[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < lo || value > hi) {
      throw new Error(`${key}: zadajte hodnotu od ${lo} do ${hi}.`);
    }
  }
  if (
    [p.root_fillet, p.tip_fillet, p.face_fillet].some(
      (v) => v !== undefined && !Number.isInteger(v),
    )
  )
    throw new Error('Vyberte model bez zaoblenia alebo s navrhovaným zaoblením.');
  if (!Number.isInteger(p.teeth1) || !Number.isInteger(p.teeth2)) {
    throw new Error('Počet zubov musí byť celé číslo.');
  }
}

export function involute(t: number, rb: number): Point2 {
  return [rb * (cos(t) + t * sin(t)), rb * (sin(t) - t * cos(t))];
}

export function flank(g: Gear, a: number, side: number, t: number): Point2 {
  const [x, y] = involute(t, g.base_diameter / 2);
  return polar(hypot(x, y), a + side * (g.base_half_angle - (t - atan(t))));
}

function inverseInv(value: number) {
  if (value <= 0) throw new Error('Korekcie nedovoľujú kladný pracovný uhol záberu.');
  let lo = 0,
    hi = radians(80);
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2;
    if (inv(mid) < value) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function outline(g: Gear, samples = 14): Point2[] {
  const points: Point2[] = [];
  const rf = g.root_diameter / 2,
    ra = g.tip_diameter / 2;
  const t0 = g.t_start,
    t1 = g.t_end;
  const h0 = g.base_half_angle - (t0 - atan(t0));
  const h1 = g.base_half_angle - (t1 - atan(t1));
  const pitch = (2 * PI) / g.teeth;
  for (let i = 0; i < g.teeth; i++) {
    const a = i * pitch;
    points.push(polar(rf, a - h0));
    for (let j = 0; j <= samples; j++) points.push(flank(g, a, -1, t0 + ((t1 - t0) * j) / samples));
    for (let j = 1; j <= 5; j++) points.push(polar(ra, a - h1 + (2 * h1 * j) / 5));
    for (let j = 1; j <= samples; j++) points.push(flank(g, a, 1, t1 - ((t1 - t0) * j) / samples));
    points.push(polar(rf, a + h0));
    for (let j = 1; j <= 6; j++) points.push(polar(rf, a + h0 + ((pitch - 2 * h0) * j) / 6));
  }
  return points.filter(
    (p, i) => !i || hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-8,
  );
}

function gear(
  m: number,
  z: number,
  alpha: number,
  x: number,
  k: number,
  bore: number,
  round: boolean,
  head: boolean,
  width: number,
  face: boolean,
): Gear {
  const d = m * z,
    db = d * cos(alpha);
  const da = m * (z + 2 + 2 * x - 2 * k),
    df = m * (z - 2.5 + 2 * x);
  if (!(df > 0 && df < da) || da <= db)
    throw new Error('Neplatné hlavové/pätné priemery pre zadanú korekciu.');
  if (bore >= df - 0.4 * m)
    throw new Error('Otvor musí zachovať aspoň 0,2 modulu materiálu pod pätou zuba.');
  const baseHalf = (PI / 2 + 2 * x * tan(alpha)) / z + inv(alpha);
  const t0 = sqrt(max(0, (max(df, db) / db) ** 2 - 1));
  const t1 = sqrt((da / db) ** 2 - 1);
  const halfTip = baseHalf - (t1 - atan(t1));
  const halfRoot = baseHalf - (t0 - atan(t0));
  if (halfTip <= 1e-5 || halfRoot >= PI / z)
    throw new Error('Korekcia vytvára špicatý zub alebo prekrývajúce sa päty zubov.');
  const g: Gear = {
    root_fillet: null,
    tip_fillet: null,
    face_radius: 0,
    teeth: z,
    profile_shift: x,
    pitch_diameter: d,
    base_diameter: db,
    tip_diameter: da,
    root_diameter: df,
    bore,
    base_half_angle: baseHalf,
    t_start: t0,
    t_end: t1,
    min_teeth: (2 * (1 - x)) / sin(alpha) ** 2,
    undercut: z < (2 * (1 - x)) / sin(alpha) ** 2 - 1e-10,
    tip_thickness: da * halfTip,
    outline: [],
  };
  if (round) g.root_fillet = proposeRootFillet(g, m);
  if (head) {
    g.tip_fillet = proposeTipFillet(g, m);
    g.tip_thickness = -da * Math.atan2(g.tip_fillet.tip[1], g.tip_fillet.tip[0]);
  }
  if (face)
    g.face_radius = Math.min(
      0.05 * m,
      0.1 * width,
      0.5 * g.root_fillet!.radius,
      0.5 * g.tip_fillet!.radius,
    );
  g.outline = round || head ? roundedOutline(g) : outline(g);
  return g;
}

export function calculate(p: Design): Analysis {
  validate(p);
  const alpha = radians(p.pressure_angle),
    xsum = p.profile1 + p.profile2;
  const aw = inverseInv(inv(alpha) + (2 * xsum * tan(alpha)) / (p.teeth1 + p.teeth2));
  const a0 = (p.module * (p.teeth1 + p.teeth2)) / 2;
  const a = (a0 * cos(alpha)) / cos(aw);
  const k = xsum - (a - a0) / p.module;
  const g1 = gear(
    p.module,
    p.teeth1,
    alpha,
    p.profile1,
    k,
    p.bore1,
    !!p.root_fillet,
    !!p.tip_fillet,
    p.width,
    !!p.face_fillet,
  );
  const g2 = gear(
    p.module,
    p.teeth2,
    alpha,
    p.profile2,
    k,
    p.bore2,
    !!p.root_fillet,
    !!p.tip_fillet,
    p.width,
    !!p.face_fillet,
  );
  const gears: [Gear, Gear] = [g1, g2];
  const rb1 = g1.base_diameter / 2,
    rb2 = g2.base_diameter / 2;
  const q1 = rb1 * (g1.tip_fillet?.t ?? g1.t_end);
  const q2 = rb2 * (g2.tip_fillet?.t ?? g2.t_end);
  const span = a * sin(aw);
  const contactRatio = (q1 + q2 - span) / (PI * p.module * cos(alpha));
  const start1 = rb1 * (g1.root_fillet?.t ?? g1.t_start);
  const start2 = rb2 * (g2.root_fillet?.t ?? g2.t_start);
  const interference = q1 > span - start2 + 1e-8 || q2 > span - start1 + 1e-8;
  const rw1 = (a * p.teeth1) / (p.teeth1 + p.teeth2),
    rw2 = (a * p.teeth2) / (p.teeth1 + p.teeth2);
  const ft = (p.torque * 1000) / rw1;
  const fn = ft / cos(aw);
  const req = (rw1 * sin(aw) * rw2 * sin(aw)) / ((rw1 + rw2) * sin(aw));
  const effectiveE = p.elastic_modulus / (2 * (1 - p.poisson_ratio ** 2));
  const effectiveWidth = p.width - 2 * Math.max(g1.face_radius, g2.face_radius);
  const hertz = sqrt((fn * effectiveE) / (PI * effectiveWidth * req));
  const lewisValid =
    abs(p.pressure_angle - 20) < 1e-9 && abs(p.profile1) < 1e-9 && abs(p.profile2) < 1e-9;
  const bending = lewisValid
    ? gears.map((g) => ft / (effectiveWidth * p.module * (0.484 - 2.87 / g.teeth)))
    : null;
  const checks = [
    { name: 'Podrezanie pastorka', ok: !g1.undercut, detail: `z₁ ≥ ${g1.min_teeth.toFixed(2)}` },
    { name: 'Podrezanie kolesa', ok: !g2.undercut, detail: `z₂ ≥ ${g2.min_teeth.toFixed(2)}` },
    {
      name: 'Evolventná interferencia',
      ok: !interference,
      detail: p.root_fillet
        ? 'Aktívny bok nad navrhovaným zaoblením päty'
        : 'Kontrola aktívnej dráhy záberu',
    },
    { name: 'Trvalý záber', ok: contactRatio >= 1, detail: `εα = ${contactRatio.toFixed(3)} ≥ 1` },
    {
      name: 'Hrúbka hlavy zuba',
      ok: Math.min(g1.tip_thickness, g2.tip_thickness) >= 0.25 * p.module,
      detail: 'Odporúčaná hrúbka ≥ 0,25 m',
    },
  ];
  return {
    effective_width: effectiveWidth,
    parameters: { ...p },
    gears,
    ratio: p.teeth2 / p.teeth1,
    center_distance: a,
    reference_center_distance: a0,
    tip_shortening: k,
    working_pressure_angle: (aw * 180) / PI,
    contact_ratio: contactRatio,
    output_rpm: (p.rpm * p.teeth1) / p.teeth2,
    tangential_force: ft,
    hertz_mpa: hertz,
    bending_mpa: bending,
    checks,
    geometry_ok: checks.every((c) => c.ok),
    limitations: [
      'Predbežný výpočet; nejde o overenie podľa ISO 6336 ani DIN 3990.',
      p.root_fillet
        ? 'Navrhované kruhové zaoblenia päty nie sú výrobná trochoida; pevnostný účinok nie je overený.'
        : 'Päty sú radiálne prechody bez generovanej trochoidy a zaoblenia.',
      'Napätia sú odhady bez dynamických faktorov a bezpečnostného súčiniteľa.',
      'STEP bez aproximácie nie je týmto CAD jadrom podporovaný.',
    ],
  };
}
