/** OpenCascade runs in a short-lived worker: no UI blocking or retained native heap.
 * Use the single-thread WASM build; Surge needs no cross-origin isolation headers.
 */
import initOpenCascade from 'replicad-opencascadejs';
import wasmUrl from 'replicad-opencascadejs/wasm?url';
import {
  setOC,
  assembleWire,
  makeFace,
  basicFaceExtrusion,
  Vector,
  makeLine,
  makeThreePointArc,
  makeBSplineApproximation,
  makeCircle,
  exportSTEP,
  measureShapeVolumeProperties,
  type Edge,
  type Point,
  type Solid,
} from 'replicad';
import { calculate, flank, polar, type Point2 } from './geometry';
import type { Design, Gear } from './types';

const point = ([x, y]: Point2): Point => [x, y, 0];

function buildGear(g: Gear, width: number): Solid {
  const edges: Edge[] = [];
  const rf = g.root_diameter / 2,
    ra = g.tip_diameter / 2;
  const t0 = g.t_start,
    t1 = g.t_end;
  const h0 = g.base_half_angle - (t0 - Math.atan(t0));
  const h1 = g.base_half_angle - (t1 - Math.atan(t1));
  const pitch = (2 * Math.PI) / g.teeth;
  function line(a: Point2, b: Point2) {
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-8) edges.push(makeLine(point(a), point(b)));
  }
  function arc(r: number, a: number, b: number) {
    // Replicad order is start, THROUGH, end (verified against the implementation).
    edges.push(
      makeThreePointArc(point(polar(r, a)), point(polar(r, (a + b) / 2)), point(polar(r, b))),
    );
  }
  for (let i = 0; i < g.teeth; i++) {
    const a = i * pitch;
    line(polar(rf, a - h0), flank(g, a, -1, t0));
    edges.push(
      makeBSplineApproximation(
        Array.from({ length: 65 }, (_, j) => point(flank(g, a, -1, t0 + ((t1 - t0) * j) / 64))),
        { tolerance: 1e-7 },
      ),
    );
    arc(ra, a - h1, a + h1);
    edges.push(
      makeBSplineApproximation(
        Array.from({ length: 65 }, (_, j) => point(flank(g, a, 1, t1 - ((t1 - t0) * j) / 64))),
        { tolerance: 1e-7 },
      ),
    );
    line(flank(g, a, 1, t0), polar(rf, a + h0));
    arc(rf, a + h0, a + pitch - h0);
  }
  const wire = assembleWire(edges);
  // Hole wires must have the opposite orientation to the outer wire.
  const hole = g.bore > 0 ? assembleWire([makeCircle(g.bore / 2, [0, 0, 0], [0, 0, -1])]) : null;
  const face = makeFace(wire, hole ? [hole] : []);
  const solid = basicFaceExtrusion(face, new Vector([0, 0, width]));
  const volume = measureShapeVolumeProperties(solid).volume;
  const lower = Math.PI * (rf ** 2 - (g.bore / 2) ** 2) * width;
  const upper = Math.PI * (ra ** 2 - (g.bore / 2) ** 2) * width;
  if (!Number.isFinite(volume) || volume <= lower || volume >= upper) {
    throw new Error('CAD jadro nevytvorilo teleso s platným objemom.');
  }
  return solid;
}

self.onmessage = async (event: MessageEvent<Design & { allow_approximation: boolean }>) => {
  try {
    if (!event.data.allow_approximation)
      throw new Error('STEP vyžaduje povolenie B-spline aproximácie.');
    const result = calculate(event.data);
    if (!result.geometry_ok)
      throw new Error('STEP je blokovaný: návrh neprešiel geometrickými kontrolami.');
    self.postMessage({ progress: 'Načítavam CAD jadro…' });
    const oc = await initOpenCascade({ locateFile: () => wasmUrl });
    setOC(oc);
    self.postMessage({ progress: 'Vytváram CAD model…' });
    const first = buildGear(result.gears[0], result.parameters.width);
    const second = buildGear(result.gears[1], result.parameters.width)
      .rotate(180 - 180 / result.gears[1].teeth)
      .translate([result.center_distance, 0, 0]);
    const blob = exportSTEP(
      [
        { shape: first, name: 'Pinion - APPROXIMATE', color: '#e2ad58' },
        { shape: second, name: 'Wheel - APPROXIMATE', color: '#74b8b9' },
      ],
      { unit: 'MM', modelUnit: 'MM' },
    );
    self.postMessage({ blob });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : 'CAD export zlyhal. Skúste menší počet zubov.',
    });
  }
};
