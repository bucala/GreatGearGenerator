import type { Analysis, Gear } from './types';

function Wheel({ g, x, angle, color }: { g: Gear; x: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x},0) rotate(${angle})`}>
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

export default function Sketch({ result }: { result: Analysis }) {
  const [g1, g2] = result.gears;
  const a = result.center_distance;
  const r = Math.max(g1.tip_diameter, g2.tip_diameter) / 2;
  const left = -g1.tip_diameter / 2 - 12;
  const width = a + g2.tip_diameter / 2 + 12 - left;
  const font = width / 55;
  const y = r + 8;
  return (
    <svg
      className="sketch"
      viewBox={`${left} ${-r - 16} ${width} ${2 * r + 40}`}
      role="img"
      aria-label="2D náčrt s rozstupovými a základnými kružnicami a osovou vzdialenosťou"
    >
      <Wheel g={g1} x={0} angle={0} color="#e6b567" />
      <Wheel g={g2} x={a} angle={180 - 180 / g2.teeth} color="#78c5c4" />
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
  );
}
