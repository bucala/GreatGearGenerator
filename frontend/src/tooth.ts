import type { Analysis, Gear } from './types';

/** Reference-circle arc dimensions, not straight chord measurements. */
export function toothDimensions(g: Gear, r: Analysis) {
  const p = r.parameters,
    alpha = (p.pressure_angle * Math.PI) / 180;
  const pitch = Math.PI * p.module;
  const thickness = p.module * (Math.PI / 2 + 2 * g.profile_shift * Math.tan(alpha));
  const rootHalf = g.root_fillet
    ? -Math.atan2(g.root_fillet.root[1], g.root_fillet.root[0])
    : g.base_half_angle - (g.t_start - Math.atan(g.t_start));
  return {
    module: p.module,
    pitch,
    thickness,
    space: pitch - thickness,
    basePitch: pitch * Math.cos(alpha),
    tipThickness: g.tip_thickness,
    tipSpace: (Math.PI * g.tip_diameter) / g.teeth - g.tip_thickness,
    rootSpace: (g.root_diameter / 2) * ((2 * Math.PI) / g.teeth - 2 * rootHalf),
    rootHalfAngle: rootHalf,
    addendum: (g.tip_diameter - g.pitch_diameter) / 2,
    dedendum: (g.pitch_diameter - g.root_diameter) / 2,
    depth: (g.tip_diameter - g.root_diameter) / 2,
    radius: g.root_fillet?.radius ?? 0,
    halfThicknessAngle: thickness / g.pitch_diameter,
  };
}
