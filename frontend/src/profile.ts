import type { Gear, RootFillet, TipFillet } from './types';
import { flank, polar, type Point2 } from './geometry';

export type ProfileSegment =
  | { kind: 'line'; start: Point2; end: Point2 }
  | { kind: 'arc'; center: Point2; radius: number; from: number; sweep: number; samples: number }
  | { kind: 'involute'; angle: number; side: number; from: number; to: number };

/** Proposed circular root blend, tangent to the root circle and radial extension
 * or involute. R=0.3m is a design starting point, not an ISO tool prescription.
 * Store the left blend at tooth angle zero; the right blend is its mirror.
 */
export function proposeRootFillet(g: Gear, module: number): RootFillet {
  const rf = g.root_diameter / 2,
    rb = g.base_diameter / 2;
  function construct(radius: number): RootFillet {
    const radial = Math.sqrt(rf * rf + 2 * rf * radius);
    let t = 0,
      tangent: Point2,
      normalAngle: number;
    if (radial <= rb) {
      tangent = polar(radial, -g.base_half_angle);
      normalAngle = -g.base_half_angle - Math.PI / 2;
    } else {
      t = (Math.sqrt((rf + radius) ** 2 - rb ** 2) - radius) / rb;
      tangent = flank(g, 0, -1, t);
      normalAngle = t - g.base_half_angle - Math.PI / 2;
    }
    const center: Point2 = [
      tangent[0] + radius * Math.cos(normalAngle),
      tangent[1] + radius * Math.sin(normalAngle),
    ];
    const root: Point2 = [(center[0] * rf) / (rf + radius), (center[1] * rf) / (rf + radius)];
    return { radius, t, tangent, center, root };
  }
  function fits(f: RootFillet) {
    const rootAngle = -Math.atan2(f.root[1], f.root[0]);
    return (
      rootAngle < Math.PI / g.teeth - 1e-6 &&
      f.t < g.t_start + 0.65 * (g.t_end - g.t_start) &&
      Math.hypot(...f.tangent) < g.tip_diameter / 2
    );
  }
  let radius = 0.3 * module;
  if (!fits(construct(radius))) {
    let lo = 0,
      hi = radius;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (fits(construct(mid))) lo = mid;
      else hi = mid;
    }
    radius = lo * 0.98;
  }
  if (radius < module * 1e-5)
    throw new Error(
      'Pre tieto parametre nemožno navrhnúť bezpečne oddelené zaoblenia päty. Použite model bez zaoblenia.',
    );
  return construct(radius);
}

const rotate = ([x, y]: Point2, a: number): Point2 => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];
const mirror = ([x, y]: Point2): Point2 => [x, -y];

export function proposeTipFillet(g: Gear, module: number): TipFillet {
  const ra = g.tip_diameter / 2,
    rb = g.base_diameter / 2;
  const start = g.root_fillet?.t ?? g.t_start;
  function construct(radius: number): TipFillet | null {
    if (ra - radius <= rb) return null;
    const t = (radius + Math.sqrt((ra - radius) ** 2 - rb ** 2)) / rb;
    const tangent = flank(g, 0, -1, t),
      angle = t - g.base_half_angle - Math.PI / 2;
    const center: Point2 = [
      tangent[0] - radius * Math.cos(angle),
      tangent[1] - radius * Math.sin(angle),
    ];
    const tip: Point2 = [(center[0] * ra) / (ra - radius), (center[1] * ra) / (ra - radius)];
    return { radius, t, tangent, center, tip };
  }
  const fits = (f: TipFillet | null) =>
    f !== null && f.tip[1] < -1e-7 * module && f.t > start + 0.35 * (g.t_end - start);
  let radius = 0.1 * module;
  if (!fits(construct(radius))) {
    let lo = 0,
      hi = radius;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (fits(construct(mid))) lo = mid;
      else hi = mid;
    }
    radius = 0.98 * lo;
  }
  if (radius < 1e-5 * module)
    throw new Error('Pre hlavu zuba nemožno navrhnúť kruhový prechod. Vypnite zaoblenie hlavy.');
  return construct(radius)!;
}

export function profileSegments(g: Gear, tooth?: number): ProfileSegment[] {
  const edges: ProfileSegment[] = [],
    rf = g.root_diameter / 2,
    ra = g.tip_diameter / 2;
  const f = g.root_fillet,
    t0 = f?.t ?? g.t_start,
    t1 = g.tip_fillet?.t ?? g.t_end;
  const h0 = g.base_half_angle - (t0 - Math.atan(t0));
  const h1 = g.base_half_angle - (t1 - Math.atan(t1));
  const pitch = (2 * Math.PI) / g.teeth;
  const rootAngle = f ? -Math.atan2(f.root[1], f.root[0]) : h0;
  const tip = g.tip_fillet,
    tipAngle = tip ? -Math.atan2(tip.tip[1], tip.tip[0]) : h1;
  const line = (start: Point2, end: Point2) => {
    if (Math.hypot(start[0] - end[0], start[1] - end[1]) > 1e-8)
      edges.push({ kind: 'line', start, end });
  };
  const fillet = (center: Point2, start: Point2, end: Point2) => {
    const from = Math.atan2(start[1] - center[1], start[0] - center[0]);
    let sweep = Math.atan2(end[1] - center[1], end[0] - center[0]) - from;
    while (sweep >= 0) sweep -= 2 * Math.PI;
    while (sweep < -2 * Math.PI) sweep += 2 * Math.PI;
    edges.push({ kind: 'arc', center, radius: f!.radius, from, sweep, samples: 12 });
  };
  const headBlend = (center: Point2, start: Point2, end: Point2) => {
    const from = Math.atan2(start[1] - center[1], start[0] - center[0]);
    let sweep = Math.atan2(end[1] - center[1], end[0] - center[0]) - from;
    while (sweep <= 0) sweep += 2 * Math.PI;
    edges.push({ kind: 'arc', center, radius: tip!.radius, from, sweep, samples: 12 });
  };
  const indices = tooth === undefined ? Array.from({ length: g.teeth }, (_, i) => i) : [tooth];
  for (const i of indices) {
    const a = i * pitch;
    if (f) {
      fillet(rotate(f.center, a), rotate(f.root, a), rotate(f.tangent, a));
      line(rotate(f.tangent, a), flank(g, a, -1, t0));
    } else line(polar(rf, a - h0), flank(g, a, -1, t0));
    edges.push({ kind: 'involute', angle: a, side: -1, from: t0, to: t1 });
    if (tip) headBlend(rotate(tip.center, a), rotate(tip.tangent, a), rotate(tip.tip, a));
    edges.push({
      kind: 'arc',
      center: [0, 0],
      radius: ra,
      from: a - tipAngle,
      sweep: 2 * tipAngle,
      samples: 5,
    });
    if (tip)
      headBlend(
        rotate(mirror(tip.center), a),
        rotate(mirror(tip.tip), a),
        rotate(mirror(tip.tangent), a),
      );
    edges.push({ kind: 'involute', angle: a, side: 1, from: t1, to: t0 });
    if (f) {
      line(flank(g, a, 1, t0), rotate(mirror(f.tangent), a));
      fillet(rotate(mirror(f.center), a), rotate(mirror(f.tangent), a), rotate(mirror(f.root), a));
    } else line(flank(g, a, 1, t0), polar(rf, a + h0));
    edges.push({
      kind: 'arc',
      center: [0, 0],
      radius: rf,
      from: a + rootAngle,
      sweep: pitch - 2 * rootAngle,
      samples: 6,
    });
  }
  return edges;
}

export function segmentPoint(g: Gear, edge: ProfileSegment, u: number): Point2 {
  if (edge.kind === 'involute')
    return flank(g, edge.angle, edge.side, edge.from + (edge.to - edge.from) * u);
  if (edge.kind === 'line')
    return [
      edge.start[0] + (edge.end[0] - edge.start[0]) * u,
      edge.start[1] + (edge.end[1] - edge.start[1]) * u,
    ];
  const p = polar(edge.radius, edge.from + edge.sweep * u);
  return [edge.center[0] + p[0], edge.center[1] + p[1]];
}

export function roundedOutline(g: Gear): Point2[] {
  const points: Point2[] = [];
  for (const edge of profileSegments(g)) {
    const n = edge.kind === 'involute' ? 28 : edge.kind === 'arc' ? edge.samples : 1;
    for (let i = 0; i <= n; i++) {
      const p = segmentPoint(g, edge, i / n),
        prev = points.at(-1);
      if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 1e-8) points.push(p);
    }
  }
  return points;
}
