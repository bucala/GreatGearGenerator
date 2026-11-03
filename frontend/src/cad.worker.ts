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
  type Shape3D,
} from 'replicad';
import { calculate, type Point2 } from './geometry';
import { profileSegments, segmentPoint } from './profile';
import type { Design, Gear } from './types';

const point = ([x, y]: Point2): Point => [x, y, 0];

function buildGear(g: Gear, width: number): Shape3D {
  const edges: Edge[] = [];
  const rf = g.root_diameter / 2,
    ra = g.tip_diameter / 2;
  for (const edge of profileSegments(g)) {
    const at = (u: number) => point(segmentPoint(g, edge, u));
    if (edge.kind === 'line') edges.push(makeLine(at(0), at(1)));
    else if (edge.kind === 'arc') edges.push(makeThreePointArc(at(0), at(0.5), at(1)));
    else
      edges.push(
        makeBSplineApproximation(
          Array.from({ length: 65 }, (_, j) => at(j / 64)),
          { tolerance: 1e-7 },
        ),
      );
  }
  const wire = assembleWire(edges);
  // Hole wires must have the opposite orientation to the outer wire.
  const hole = g.bore > 0 ? assembleWire([makeCircle(g.bore / 2, [0, 0, 0], [0, 0, -1])]) : null;
  const face = makeFace(wire, hole ? [hole] : []);
  let solid: Shape3D = basicFaceExtrusion(face, new Vector([0, 0, width]));
  if (g.face_radius)
    solid = solid.fillet((edge) => {
      const box = edge.boundingBox,
        [lo, hi] = box.bounds;
      box.delete();
      return Math.abs(hi[2] - lo[2]) < 1e-6 ? g.face_radius : null;
    });
  const volume = measureShapeVolumeProperties(solid).volume;
  const lower = Math.PI * (rf ** 2 - (g.bore / 2) ** 2) * width;
  const upper = Math.PI * (ra ** 2 - (g.bore / 2) ** 2) * width;
  if (!Number.isFinite(volume) || volume <= lower || volume >= upper) {
    throw new Error('CAD jadro nevytvorilo teleso s platným objemom.');
  }
  return solid;
}

self.onmessage = async (
  event: MessageEvent<Design & { allow_approximation: boolean; action?: 'mesh' | 'step' }>,
) => {
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
    const rawSecond = buildGear(result.gears[1], result.parameters.width);
    const meshes =
      event.data.action === 'mesh'
        ? [
            first.mesh({ tolerance: 0.02, angularTolerance: 0.12 }),
            rawSecond.mesh({ tolerance: 0.02, angularTolerance: 0.12 }),
          ]
        : undefined;
    const second = rawSecond
      .rotate(180 - 180 / result.gears[1].teeth)
      .translate([result.center_distance, 0, 0]);
    const blob = exportSTEP(
      [
        { shape: first, name: 'Pinion - APPROXIMATE', color: '#e2ad58' },
        { shape: second, name: 'Wheel - APPROXIMATE', color: '#74b8b9' },
      ],
      { unit: 'MM', modelUnit: 'MM' },
    );
    self.postMessage({ blob, meshes });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : 'CAD export zlyhal. Skúste menší počet zubov.',
    });
  }
};
