import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';
import type { Analysis, Gear } from './types';
import ViewerZoomControls from './ViewerZoomControls';

function Wheel({
  g,
  x,
  angle,
  color,
  rotationRef,
  label,
}: {
  g: Gear;
  x: number;
  angle: number;
  color: string;
  rotationRef: Ref<SVGGElement>;
  label: string;
}) {
  return (
    <g ref={rotationRef} transform={`translate(${x},0) rotate(${angle})`} aria-label={label}>
      <polygon
        points={g.outline.map((p) => p.join(',')).join(' ')}
        fill={color}
        fillOpacity="0.13"
        stroke={color}
        strokeWidth="0.35"
      />
      <circle r={g.bore / 2} fill="var(--viewer)" stroke={color} strokeWidth="0.3" />
      <circle
        r={g.pitch_diameter / 2}
        fill="none"
        stroke={color}
        strokeDasharray="2 1"
        strokeWidth="0.2"
      />
      <circle
        r={g.base_diameter / 2}
        fill="none"
        stroke={color}
        strokeDasharray="0.6 1.2"
        strokeWidth="0.15"
        opacity="0.7"
      />
      <path d="M-2 0 H2 M0 -2 V2" stroke={color} strokeWidth="0.25" />
    </g>
  );
}

const minZoom = 0.5;
const maxZoom = 4;
const clampZoom = (zoom: number) => Math.min(maxZoom, Math.max(minZoom, zoom));
type Point = { x: number; y: number };
const initialView = { zoom: 1, x: 0, y: 0 };

export default function Sketch({
  result,
  animate,
  interactive,
}: {
  result: Analysis;
  animate: boolean;
  interactive: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const pinion = useRef<SVGGElement>(null);
  const wheel = useRef<SVGGElement>(null);
  const angle = useRef(0);
  const pointers = useRef(new Map<number, Point>());
  const [view, setView] = useState(initialView);
  const [g1, g2] = result.gears;
  const a = result.center_distance;
  const r = Math.max(g1.tip_diameter, g2.tip_diameter) / 2;
  const left = -g1.tip_diameter / 2 - 12;
  const width = a + g2.tip_diameter / 2 + 12 - left;
  const height = 2 * r + 40;
  const center = { x: left + width / 2, y: 4 };
  const font = width / 55;
  const y = r + 8;
  const phase = 180 - 180 / g2.teeth;
  const ratio = result.ratio;
  useEffect(() => {
    function renderAngle() {
      pinion.current?.setAttribute('transform', `translate(0,0) rotate(${angle.current})`);
      wheel.current?.setAttribute(
        'transform',
        `translate(${a},0) rotate(${phase - angle.current / ratio})`,
      );
    }
    renderAngle();
    if (!animate) return;
    let frame: number;
    let previous: number | undefined;
    function tick(time: number) {
      if (previous !== undefined)
        angle.current += (Math.min((time - previous) / 1000, 0.1) * 0.22 * 180) / Math.PI;
      previous = time;
      renderAngle();
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, a, phase, ratio]);

  // A non-passive listener keeps the page still while zooming the drawing.
  useEffect(() => {
    const element = svg.current;
    if (!element || !interactive) return;
    const zoomWheel = (event: WheelEvent) => {
      event.preventDefault();
      const pixels =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      setView((v) => ({ ...v, zoom: clampZoom(v.zoom * Math.exp(-pixels * 0.001)) }));
    };
    element.addEventListener('wheel', zoomWheel, { passive: false });
    return () => element.removeEventListener('wheel', zoomWheel);
  }, [interactive]);

  function movePointer(event: ReactPointerEvent<SVGSVGElement>) {
    const active = pointers.current;
    if (!interactive || !active.has(event.pointerId)) return;
    const before = [...active.values()].slice(0, 2);
    active.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...active.values()].slice(0, 2);
    const inverse = event.currentTarget.getScreenCTM()?.inverse();
    if (!inverse) return;
    const midpoint = (points: Point[]) =>
      new DOMPoint(
        points.reduce((s, p) => s + p.x, 0) / points.length,
        points.reduce((s, p) => s + p.y, 0) / points.length,
      ).matrixTransform(inverse);
    const oldPoint = midpoint(before),
      nextPoint = midpoint(after);
    const distance = (points: Point[]) =>
      Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const factor =
      before.length === 2 && distance(before) > 0 ? distance(after) / distance(before) : 1;
    setView((v) => {
      const zoom = clampZoom(v.zoom * factor);
      const scale = v.zoom / zoom;
      return {
        zoom,
        x: oldPoint.x - (nextPoint.x - center.x - v.x) * scale - center.x,
        y: oldPoint.y - (nextPoint.y - center.y - v.y) * scale - center.y,
      };
    });
  }

  function releasePointer(event: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return (
    <div className="sketch-host">
      <svg
        ref={svg}
        className="sketch"
        viewBox={`${center.x + view.x - width / view.zoom / 2} ${center.y + view.y - height / view.zoom / 2} ${width / view.zoom} ${height / view.zoom}`}
        role="img"
        aria-label="2D náčrt s rozstupovými a základnými kružnicami a osovou vzdialenosťou"
        onPointerDown={(event) => {
          if (!interactive || event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }}
        onPointerMove={movePointer}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onLostPointerCapture={(event) => pointers.current.delete(event.pointerId)}
      >
        <Wheel g={g1} x={0} angle={0} color="#e6b567" rotationRef={pinion} label="Pastorok" />
        <Wheel g={g2} x={a} angle={phase} color="#78c5c4" rotationRef={wheel} label="Koleso" />
        <g stroke="var(--viewer-text)" strokeWidth="0.2" fill="none">
          <path d={`M0 0 V${y + 3} M${a} 0 V${y + 3} M0 ${y} H${a}`} />
          <path d={`M-1 ${y + 1} L1 ${y - 1} M${a - 1} ${y + 1} L${a + 1} ${y - 1}`} />
        </g>
        <g fill="var(--viewer-text)" fontSize={font} textAnchor="middle" fontFamily="monospace">
          <text x={a / 2} y={y - 2}>
            a = {a.toFixed(3)} mm
          </text>
          <text x={0} y={-g1.tip_diameter / 2 - 5}>
            d₁ = {g1.pitch_diameter.toFixed(2)} mm
          </text>
          <text x={a} y={-g2.tip_diameter / 2 - 5}>
            d₂ = {g2.pitch_diameter.toFixed(2)} mm
          </text>
        </g>
      </svg>
      <ViewerZoomControls
        dimension="2D"
        zoom={Math.round(view.zoom * 100)}
        disabled={!interactive}
        canZoomIn={view.zoom < maxZoom}
        canZoomOut={view.zoom > minZoom}
        onZoomIn={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom * 1.25) }))}
        onZoomOut={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom / 1.25) }))}
        onReset={() => setView(initialView)}
      />
    </div>
  );
}
