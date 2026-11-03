import { describe, expect, it } from 'vitest';
import { identify, type Measurements } from './reverse';
import { calculate } from './geometry';
import { defaults } from './types';

const measured: Measurements = {
  mode: 'single',
  teeth1: 24,
  tip1: 52,
  root1: 43,
  pressureAngle: 20,
  tolerance: 0.01,
  unshifted: false,
};

describe('inverse gear identification', () => {
  it.each([
    { module: 1.25, teeth1: 32, teeth2: 52, pressure_angle: 20, profile1: -0.1, profile2: 0.2 },
    { module: 3, teeth1: 18, teeth2: 36, pressure_angle: 25, profile1: 0.4, profile2: -0.1 },
    { module: 0.8, teeth1: 40, teeth2: 80, pressure_angle: 14.5, profile1: 0, profile2: 0 },
  ])('round-trips measured pairs across modules, angles and corrections: %j', (parameters) => {
    const source = calculate({ ...defaults, ...parameters, bore1: 0, bore2: 0 });
    const result = identify({
      mode: 'pair',
      teeth1: parameters.teeth1,
      teeth2: parameters.teeth2,
      pressureAngle: parameters.pressure_angle,
      center: source.center_distance,
      tolerance: 0.0001,
      tip1: source.gears[0].tip_diameter,
      root1: source.gears[0].root_diameter,
      tip2: source.gears[1].tip_diameter,
      root2: source.gears[1].root_diameter,
      unshifted: false,
    });
    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];
    expect(candidate.module).toBe(parameters.module);
    expect(candidate.shift1).toBeCloseTo(parameters.profile1, 9);
    expect(candidate.shift2).toBeCloseTo(parameters.profile2, 9);
    expect(candidate.design).not.toBeNull();
    const reconstructed = calculate(candidate.design!);
    source.gears.forEach((g, i) => {
      expect(reconstructed.gears[i].tip_diameter).toBeCloseTo(g.tip_diameter, 9);
      expect(reconstructed.gears[i].root_diameter).toBeCloseTo(g.root_diameter, 9);
    });
  });
  it('recovers module and shift from two independent diameters', () => {
    const result = identify(measured);
    expect(result.candidates).toHaveLength(1);
    const c = result.candidates[0];
    expect(c.module).toBe(2);
    expect(c.shift1).toBeCloseTo(0, 10);
    expect(c.rms).toBeCloseTo(0, 10);
    expect(c.design).not.toBeNull();
    const forward = calculate(c.design!);
    expect(forward.gears[0].tip_diameter).toBeCloseTo(52, 10);
    expect(forward.gears[0].root_diameter).toBeCloseTo(43, 10);
  });

  it('does not manufacture a unique pressure angle from tip and root', () => {
    const result = identify({ ...measured, pressureAngle: undefined });
    expect(result.candidates.map((c) => c.angle).sort((a, b) => a - b)).toEqual([14.5, 20, 25, 30]);
    expect(result.candidates.every((c) => c.rms < 1e-9)).toBe(true);
  });

  it('retains shift uncertainty for a base-circle-only measurement', () => {
    const result = identify({
      ...measured,
      module: 2,
      tip1: undefined,
      root1: undefined,
      base1: 48 * Math.cos((20 * Math.PI) / 180),
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].shiftRange).toEqual([-0.5, 0.8]);
  });

  it('shows ambiguous modules when tolerance allows distinct alternatives', () => {
    const result = identify({ ...measured, teeth1: 8, tip1: 22, root1: undefined, tolerance: 0.6 });
    expect(new Set(result.candidates.map((c) => c.module)).size).toBeGreaterThan(1);
    for (const c of result.candidates)
      for (const r of c.residuals) expect(Math.abs(r.delta)).toBeLessThanOrEqual(0.6 + 1e-9);
  });

  it('fits noisy measurements without rounding module or discarding inconsistency', () => {
    const result = identify({ ...measured, tip1: 52.03, root1: 42.98, tolerance: 0.03 });
    expect(result.candidates).toHaveLength(1);
    for (const r of result.candidates[0].residuals)
      expect(Math.abs(r.delta)).toBeLessThanOrEqual(0.03);
    expect(identify({ ...measured, tip1: 52.03, root1: 42.98 }).candidates).toHaveLength(0);
  });

  it('uses a base circle to separate pressure-angle candidates', () => {
    const result = identify({
      ...measured,
      pressureAngle: undefined,
      base1: 48 * Math.cos((20 * Math.PI) / 180),
    });
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].angle).toBe(20);
  });

  it('recovers a corrected pair using the actual forward shortening model', () => {
    const forward = calculate({ ...defaults, profile1: 0.3, profile2: 0.1 });
    const result = identify({
      ...measured,
      mode: 'pair',
      teeth2: 48,
      center: forward.center_distance,
      tip1: forward.gears[0].tip_diameter,
      root1: forward.gears[0].root_diameter,
      tip2: forward.gears[1].tip_diameter,
      root2: forward.gears[1].root_diameter,
    });
    expect(result.candidates).toHaveLength(1);
    const c = result.candidates[0];
    expect(c.shift1).toBeCloseTo(0.3, 9);
    expect(c.shift2).toBeCloseTo(0.1, 9);
    expect(c.design).not.toBeNull();
    const reconstructed = calculate(c.design!);
    expect(reconstructed.center_distance).toBeCloseTo(forward.center_distance, 9);
    expect(reconstructed.gears[0].tip_diameter).toBeCloseTo(forward.gears[0].tip_diameter, 9);
  });

  it('rejects an impossible pair center and mismatched second-gear measurement', () => {
    expect(identify({ ...measured, mode: 'pair', teeth2: 48, center: 1 }).candidates).toHaveLength(
      0,
    );
    expect(
      identify({ ...measured, mode: 'pair', teeth2: 48, center: 72, root2: 100 }).candidates,
    ).toHaveLength(0);
  });

  it('honors an explicit zero-shift assumption and custom module', () => {
    const m = 1.7,
      x = 0.2;
    const input = {
      ...measured,
      module: m,
      tip1: m * (24 + 2 + 2 * x),
      root1: m * (24 - 2.5 + 2 * x),
    };
    expect(identify(input).candidates[0].shift1).toBeCloseTo(x, 10);
    expect(identify({ ...input, unshifted: true }).candidates).toHaveLength(0);
  });

  it('disables transfer if the existing pair model cannot represent the hypothetical mate', () => {
    const result = identify({ ...measured, tip1: 54.8, root1: 45.8 });
    expect(result.candidates[0].shift1).toBeCloseTo(0.7, 10);
    expect(result.candidates[0].design).toBeNull();
    expect(result.candidates[0].transferIssue).not.toBe('');
  });

  it.each([
    { teeth1: 12.5 },
    { teeth1: 0 },
    { tip1: NaN },
    { tolerance: 0 },
    { tolerance: Infinity },
    { pressureAngle: 90 },
    { module: -1 },
    { tip1: 40, root1: 43 },
    { mode: 'pair', teeth2: 48 },
    { tip1: undefined, root1: undefined },
  ])('rejects invalid / incomplete measurements %j', (overrides) => {
    expect(() => identify({ ...measured, ...overrides } as Measurements)).toThrow();
  });
});
