import { useId, useRef, useState } from 'react';
import { ArrowDownToLine, Ruler } from 'lucide-react';
import type { Analysis, Gear } from './types';
import { polar, type Point2 } from './geometry';
import { profileSegments, segmentPoint, type ProfileSegment } from './profile';
import { toothDimensions } from './tooth';

const fmt = (v: number) => v.toLocaleString('sk-SK', { maximumFractionDigits: 4 });
const project = ([x, y]: Point2): Point2 => [-y, -x];
const xy = (p: Point2) => project(p).join(' ');

function edgePath(g: Gear, edge: ProfileSegment) {
  if (edge.kind === 'line') return `L ${xy(edge.end)}`;
  if (edge.kind === 'arc')
    return `A ${edge.radius} ${edge.radius} 0 ${Math.abs(edge.sweep) > Math.PI ? 1 : 0} ${edge.sweep < 0 ? 1 : 0} ${xy(segmentPoint(g, edge, 1))}`;
  return Array.from({ length: 96 }, (_, i) => `L ${xy(segmentPoint(g, edge, (i + 1) / 96))}`).join(
    ' ',
  );
}

export default function ToothDetail({ result }: { result: Analysis }) {
  const [selected, setSelected] = useState(0);
  const ref = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/:/g, '');
  const arrow = `tooth-arrow-${uid}`;
  const g = result.gears[selected],
    d = toothDimensions(g, result),
    m = d.module;
  const ra = g.tip_diameter / 2,
    rf = g.root_diameter / 2,
    rb = g.base_diameter / 2,
    r = g.pitch_diameter / 2;
  const pitchAngle = (2 * Math.PI) / g.teeth,
    half = d.halfThicknessAngle;
  const top = -ra - 2.4 * m,
    bottom = Math.max(-Math.min(rf, rb) + 1.8 * m, top + 7.7 * m);
  const edges = [...profileSegments(g, -1), ...profileSegments(g, 0)];
  const path = `M ${xy(segmentPoint(g, edges[0], 0))} ${edges.map((e) => edgePath(g, e)).join(' ')}`;
  const blue = '#1d5e9c',
    ink = '#233d4b';
  const dimStyle = {
    stroke: blue,
    strokeWidth: 0.018 * m,
    fill: 'none',
    markerStart: `url(#${arrow})`,
    markerEnd: `url(#${arrow})`,
  };
  const label = (value: string, x: number, y: number) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill={blue}
      fontSize={0.24 * m}
      paintOrder="stroke"
      stroke="white"
      strokeWidth={0.07 * m}
    >
      {value}
    </text>
  );
  const height = (name: string, a: number, b: number, x: number) => (
    <g>
      <path
        d={`M ${-1.4 * m} ${-a} H ${x - 0.12 * m} M ${-1.4 * m} ${-b} H ${x - 0.12 * m}`}
        stroke={blue}
        strokeWidth={0.01 * m}
      />
      <path d={`M ${x} ${-a} V ${-b}`} {...dimStyle} />
      <text
        x={x - 0.18 * m}
        y={-(a + b) / 2}
        transform={`rotate(-90 ${x - 0.18 * m} ${-(a + b) / 2})`}
        textAnchor="middle"
        fill={blue}
        fontSize={0.22 * m}
        paintOrder="stroke"
        stroke="white"
        strokeWidth={0.06 * m}
      >
        {name} = {fmt(a - b)}
      </text>
    </g>
  );
  const arcDim = (
    radius: number,
    from: number,
    to: number,
    name: string,
    value: number,
    reference = r,
  ) => (
    <g>
      {[from, to].map((a) => (
        <path
          key={a}
          d={`M ${xy(polar(reference, a))} L ${xy(polar(radius + 0.12 * m, a))}`}
          stroke={blue}
          strokeWidth={0.01 * m}
        />
      ))}
      <path
        d={`M ${xy(polar(radius, from))} A ${radius} ${radius} 0 0 ${to > from ? 0 : 1} ${xy(polar(radius, to))}`}
        {...dimStyle}
      />
      {label(`${name} = ${fmt(value)}`, ...project(polar(radius + 0.18 * m, (from + to) / 2)))}
    </g>
  );
  const diameters = [
    ['dₐ', ra, '#a75525'],
    ['d / Dr', r, blue],
    ['dᵦ', rb, '#647787'],
    ['dᶠ', rf, '#3a7c60'],
  ] as const;
  const pressure = (result.parameters.pressure_angle * Math.PI) / 180;
  const contact = project(polar(r, -half));
  const around = (angle: number, length: number): Point2 => [
    contact[0] + length * Math.cos(angle),
    contact[1] + length * Math.sin(angle),
  ];
  function downloadSvg() {
    if (!ref.current) return;
    const source = new XMLSerializer().serializeToString(ref.current);
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `gear-${selected + 1}-dimensioned-tooth.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel tooth-detail" aria-label="Kótovaný detail zuba">
      <div className="panel-title">
        <Ruler size={17} />
        <h2>Zub a zubová medzera · kótovaný detail</h2>
      </div>
      <div className="tooth-toolbar">
        <div className="mode-tabs" role="group" aria-label="Koleso pre detail zuba">
          <button
            type="button"
            className={selected === 0 ? 'active' : ''}
            aria-pressed={selected === 0}
            onClick={() => setSelected(0)}
          >
            Pastorok · z₁
          </button>
          <button
            type="button"
            className={selected === 1 ? 'active' : ''}
            aria-pressed={selected === 1}
            onClick={() => setSelected(1)}
          >
            Koleso · z₂
          </button>
        </div>
        <button type="button" className="secondary" onClick={downloadSvg}>
          <ArrowDownToLine size={15} /> Stiahnuť kótovaný SVG
        </button>
      </div>
      <div className="tooth-drawing-scroll">
        <svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`${-5.4 * m} ${top} ${14.6 * m} ${bottom - top}`}
          role="img"
          aria-label={`Geometricky kótovaný zub a zubová medzera – ${selected === 0 ? 'pastorok' : 'koleso'}`}
          style={{ background: 'white', fontFamily: 'Arial, sans-serif' }}
        >
          <title>Zub a zubová medzera – analytické kóty v mm, evolventa vzorkovaná</title>
          <defs>
            <marker
              id={arrow}
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 6 3 L 0 6 Z" fill={blue} />
            </marker>
          </defs>
          <rect x={-5.4 * m} y={top} width={14.6 * m} height={bottom - top} fill="white" />
          <text x={-5 * m} y={top + 0.4 * m} fill={ink} fontSize={0.28 * m}>
            DETAIL {selected + 1} · {g.root_fillet ? 'KRUHOVÉ ZAOBLENIE PÄTY' : 'BEZ ZAOBLENIA'} ·
            mm
          </text>
          <circle cx="0" cy="0" r={rf} fill="#eaf0f3" />
          <path d={`${path} L 0 0 Z`} fill="#eaf0f3" />
          {g.bore > 0 && (
            <circle cx="0" cy="0" r={g.bore / 2} fill="white" stroke={ink} strokeWidth={0.02 * m} />
          )}
          <path d={path} fill="none" stroke={ink} strokeWidth={0.035 * m} />
          {diameters.map(([name, radius, color]) => (
            <g key={name}>
              <circle
                cx="0"
                cy="0"
                r={radius}
                stroke={color}
                strokeWidth={0.012 * m}
                fill="none"
                strokeDasharray={
                  name === 'd / Dr' ? `${0.2 * m} ${0.1 * m}` : `${0.04 * m} ${0.09 * m}`
                }
              />
            </g>
          ))}
          <path
            d={`M 0 ${top + 0.7 * m} V ${bottom} M ${xy(polar(ra + 1.8 * m, -pitchAngle))} L 0 0`}
            stroke="#8799a3"
            strokeWidth={0.01 * m}
            strokeDasharray={`${0.16 * m} ${0.08 * m}`}
          />
          {arcDim(
            ra + 0.12 * m,
            -g.tip_thickness / g.tip_diameter,
            g.tip_thickness / g.tip_diameter,
            'sₐ',
            d.tipThickness,
            ra,
          )}
          {arcDim(ra + 0.5 * m, -half, half, 's', d.thickness)}
          {arcDim(ra + 0.5 * m, -pitchAngle + half, -half, 'e', d.space)}
          {arcDim(ra + 1.35 * m, -pitchAngle, 0, 'p', d.pitch)}
          {arcDim(
            rf - 0.45 * m,
            -pitchAngle + d.rootHalfAngle,
            -d.rootHalfAngle,
            'eᶠ',
            d.rootSpace,
            rf,
          )}
          {height('hₐ', ra, r, -2.7 * m)}
          {height('hᶠ', r, rf, -2.7 * m)}
          {height('h', ra, rf, -3.8 * m)}
          <g stroke={blue} strokeWidth={0.012 * m} fill="none">
            <path
              d={`M ${around(half, 1.1 * m).join(' ')} L ${contact.join(' ')} L ${around(half - pressure, 1.1 * m).join(' ')}`}
            />
            <path
              d={`M ${around(half - pressure, 0.65 * m).join(' ')} A ${0.65 * m} ${0.65 * m} 0 0 1 ${around(half, 0.65 * m).join(' ')}`}
            />
          </g>
          {label(
            `α = ${fmt(result.parameters.pressure_angle)}°`,
            ...around(half - pressure / 2, 1.55 * m),
          )}
          {g.root_fillet &&
            profileSegments(g, 0)
              .filter((e) => e.kind === 'arc' && Math.hypot(...e.center) > 1e-8)
              .map((e, i) => (
                <g key={i}>
                  <path
                    d={`M ${xy(segmentPoint(g, e, 0))} ${edgePath(g, e)}`}
                    fill="none"
                    stroke="#c86327"
                    strokeWidth={0.05 * m}
                  />
                  {i === 0 && (
                    <>
                      <path
                        d={`M ${xy(segmentPoint(g, e, 0.5))} L ${-1.9 * m} ${-rf + 0.7 * m} H ${0.7 * m}`}
                        fill="none"
                        stroke="#c86327"
                        strokeWidth={0.015 * m}
                      />
                      <text x={-0.6 * m} y={-rf + 0.95 * m} fill="#a44b1f" fontSize={0.24 * m}>
                        R = {fmt(d.radius)}
                      </text>
                    </>
                  )}
                </g>
              ))}
          <g fill={ink} fontSize={0.25 * m}>
            <text x={5.3 * m} y={top + 1 * m}>
              m = {fmt(m)} mm
            </text>
            <text x={5.3 * m} y={top + 1.45 * m}>
              z = {g.teeth} · α = {fmt(result.parameters.pressure_angle)}°
            </text>
            <text x={5.3 * m} y={top + 1.9 * m}>
              x = {fmt(g.profile_shift)} · b = {fmt(result.parameters.width)}
            </text>
            {diameters.map(([name, radius, color], i) => {
              const x = 1.25 * m,
                y = -Math.sqrt(radius * radius - x * x),
                target = top + (2.65 + i * 0.45) * m;
              return (
                <g key={name}>
                  <circle cx={x} cy={y} r={0.035 * m} fill={color} />
                  <path
                    d={`M ${x} ${y} L ${4.5 * m} ${y} L ${5.1 * m} ${target - 0.08 * m}`}
                    stroke={color}
                    strokeWidth={0.012 * m}
                    fill="none"
                  />
                  <text x={5.3 * m} y={target} fill={color}>
                    Ø {name} = {fmt(2 * radius)}
                  </text>
                </g>
              );
            })}
            <text x={5.3 * m} y={top + 4.9 * m}>
              Otvor Ø = {fmt(g.bore)}
            </text>
            <text x={5.3 * m} y={top + 5.35 * m}>
              R päty = {fmt(d.radius)}
            </text>
            <text x={5.3 * m} y={top + 5.8 * m}>
              pᵦ = {fmt(d.basePitch)}
            </text>
            <text x={5.3 * m} y={top + 6.25 * m}>
              eₐ = {fmt(d.tipSpace)}
            </text>
            <text x={5.3 * m} y={top + 6.7 * m}>
              eᶠ = {fmt(d.rootSpace)}
            </text>
          </g>
          <text x={-5 * m} y={bottom - 0.45 * m} fill={ink} fontSize={0.2 * m}>
            s, e, p sú dĺžky oblúkov na rozstupovej kružnici. Kóty nie sú rozmery vytlačeného SVG.
          </text>
        </svg>
      </div>
      <div className="tooth-values">
        <dl>
          {[
            ['m · modul', m],
            ['d / Dr · rozstupový Ø', 2 * r],
            ['dₐ · hlavový Ø', 2 * ra],
            ['dᶠ / Df · pätný Ø', 2 * rf],
            ['dᵦ · základný Ø', 2 * rb],
            ['p · rozstup', d.pitch],
            ['s · hrúbka zuba na d', d.thickness],
            ['e · zubová medzera na d', d.space],
            ['pᵦ · základný rozstup', d.basePitch],
            ['sₐ · hrúbka zuba na dₐ', d.tipThickness],
            ['eₐ · medzera na dₐ', d.tipSpace],
            ['eᶠ · voľný oblúk päty na dᶠ', d.rootSpace],
            ['hₐ · výška hlavy', d.addendum],
            ['hᶠ · výška päty', d.dedendum],
            ['h · celková výška', d.depth],
            ['R · polomer zaoblenia', d.radius],
          ].map(([name, value]) => (
            <div key={name as string}>
              <dt>{name}</dt>
              <dd>{fmt(value as number)} mm</dd>
            </div>
          ))}
        </dl>
        <p className="hint">
          Dr tu znamená rozstupový priemer; Df je pätný priemer. Kóty vychádzajú z analytického
          modelu. Evolventa v SVG je vzorkovaná, kruhové oblúky sú vektorové. Zaoblenie nie je
          výrobná trochoida ani zaoblenie hrán po šírke.
        </p>
      </div>
    </section>
  );
}
