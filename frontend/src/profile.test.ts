import { describe, expect, it } from 'vitest';
import { calculate } from './geometry';
import { defaults } from './types';
import { profileSegments, segmentPoint } from './profile';
import { toothDimensions } from './tooth';

describe('tangent circular root blends', () => {
  it('adds tangent tip blends and shortens the active contact length', () => {
    const base = calculate({ ...defaults, root_fillet: 1 }),
      rounded = calculate({ ...defaults, root_fillet: 1, tip_fillet: 1, face_fillet: 1 });
    expect(rounded.geometry_ok).toBe(true);
    expect(rounded.contact_ratio).toBeLessThan(base.contact_ratio);
    rounded.gears.forEach((g, i) => {
      const f = g.tip_fillet!;
      expect(Math.hypot(...f.center)).toBeCloseTo(g.tip_diameter / 2 - f.radius, 9);
      expect(Math.hypot(...f.tip)).toBeCloseTo(g.tip_diameter / 2, 9);
      expect(Math.hypot(f.tangent[0] - f.center[0], f.tangent[1] - f.center[1])).toBeCloseTo(
        f.radius,
        9,
      );
      expect(g.tip_thickness).toBeLessThan(base.gears[i].tip_thickness);
      expect(g.face_radius).toBeCloseTo(0.1, 10);
      const edges = profileSegments(g);
      edges.forEach((edge, j) => {
        const a = segmentPoint(g, edge, 1),
          b = segmentPoint(g, edges[(j + 1) % edges.length], 0);
        expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-7);
      });
    });
    expect(() => calculate({ ...defaults, face_fillet: 1 })).toThrow();
  });
  it.each([
    {},
    { teeth1: 80, teeth2: 120, bore1: 0, bore2: 0 },
    { module: 0.2, bore1: 0, bore2: 0 },
    { profile1: 0.2, profile2: -0.2 },
    { pressure_angle: 30 },
  ])('preserves circles and creates continuous tangent boundaries %j', (overrides) => {
    const sharp = calculate({ ...defaults, ...overrides, root_fillet: 0 });
    const rounded = calculate({ ...defaults, ...overrides, root_fillet: 1 });
    rounded.gears.forEach((g, index) => {
      const f = g.root_fillet!;
      expect(f.radius).toBeGreaterThan(0);
      expect(f.radius).toBeLessThanOrEqual(0.3 * rounded.parameters.module);
      expect(g.pitch_diameter).toBe(sharp.gears[index].pitch_diameter);
      expect(g.root_diameter).toBe(sharp.gears[index].root_diameter);
      expect(g.tip_diameter).toBe(sharp.gears[index].tip_diameter);
      expect(Math.hypot(...f.root)).toBeCloseTo(g.root_diameter / 2, 9);
      expect(Math.hypot(...f.center)).toBeCloseTo(g.root_diameter / 2 + f.radius, 9);
      expect(Math.hypot(f.tangent[0] - f.center[0], f.tangent[1] - f.center[1])).toBeCloseTo(
        f.radius,
        9,
      );
      const tangentAngle = f.t - g.base_half_angle;
      const radiusVector = [f.tangent[0] - f.center[0], f.tangent[1] - f.center[1]];
      expect(
        radiusVector[0] * Math.cos(tangentAngle) + radiusVector[1] * Math.sin(tangentAngle),
      ).toBeCloseTo(0, 9);
      const edges = profileSegments(g);
      edges.forEach((edge, i) => {
        const end = segmentPoint(g, edge, 1),
          start = segmentPoint(g, edges[(i + 1) % edges.length], 0);
        expect(Math.hypot(end[0] - start[0], end[1] - start[1])).toBeLessThan(1e-7);
      });
      expect(g.outline).not.toEqual(sharp.gears[index].outline);
      expect(g.outline.every((p) => p.every(Number.isFinite))).toBe(true);
    });
  });
  it('keeps the unrounded variant and rejects unsupported modes', () => {
    expect(calculate(defaults).gears.every((g) => g.root_fillet === null)).toBe(true);
    for (const root_fillet of [-1, 0.5, 2, NaN])
      expect(() => calculate({ ...defaults, root_fillet })).toThrow();
  });
  it('computes reference arc thickness, space and radial heights for dimensioning', () => {
    const result = calculate({ ...defaults, root_fillet: 1 }),
      g = result.gears[0];
    const d = toothDimensions(g, result);
    expect(d.thickness).toBeCloseTo(Math.PI, 12);
    expect(d.space).toBeCloseTo(Math.PI, 12);
    expect(d.pitch).toBeCloseTo(2 * Math.PI, 12);
    expect(d.thickness + d.space).toBeCloseTo(d.pitch, 12);
    expect(d.addendum).toBeCloseTo(2, 12);
    expect(d.dedendum).toBeCloseTo(2.5, 12);
    expect(d.depth).toBeCloseTo(4.5, 12);
    expect(d.radius).toBeCloseTo(0.6, 12);
    expect(d.basePitch).toBeCloseTo(2 * Math.PI * Math.cos(Math.PI / 9), 12);
    expect(d.tipThickness + d.tipSpace).toBeCloseTo((Math.PI * g.tip_diameter) / g.teeth, 12);
    expect(d.rootSpace).toBeGreaterThan(0);
    const sharp = calculate({ ...defaults, root_fillet: 0 });
    expect(d.rootSpace).toBeLessThan(toothDimensions(sharp.gears[0], sharp).rootSpace);
    expect(g.pitch_diameter * d.halfThicknessAngle).toBeCloseTo(d.thickness, 12);
  });
});
