import { describe, expect, it } from 'vitest';
import { calculate } from './geometry';
import { defaults, type Design } from './types';
import fixtures from './fixtures/python-reference.json';

describe('browser calculations match the Python engine', () => {
  for (const { name, expected } of fixtures) {
    it(name, () => {
      const actual = calculate(expected.parameters);
      for (const key of [
        'ratio',
        'center_distance',
        'reference_center_distance',
        'tip_shortening',
        'working_pressure_angle',
        'contact_ratio',
        'output_rpm',
        'tangential_force',
        'hertz_mpa',
      ] as const) {
        expect(actual[key]).toBeCloseTo(expected[key], 9);
      }
      expect(actual.geometry_ok).toBe(expected.geometry_ok);
      expect(actual.checks).toEqual(expected.checks);
      if (expected.bending_mpa)
        expected.bending_mpa.forEach((v, i) => expect(actual.bending_mpa?.[i]).toBeCloseTo(v, 9));
      else expect(actual.bending_mpa).toBeNull();
      actual.gears.forEach((g, i) => {
        const reference = expected.gears[i];
        for (const key of [
          'pitch_diameter',
          'base_diameter',
          'tip_diameter',
          'root_diameter',
          'base_half_angle',
          't_start',
          't_end',
          'min_teeth',
          'tip_thickness',
        ] as const) {
          expect(g[key]).toBeCloseTo(reference[key], 9);
        }
        expect(g.undercut).toBe(reference.undercut);
        expect(g.outline).toHaveLength(reference.outline_length);
        for (const [index, point] of reference.outline_samples as [number, [number, number]][]) {
          expect(g.outline[index][0]).toBeCloseTo(point[0], 8);
          expect(g.outline[index][1]).toBeCloseTo(point[1], 8);
        }
      });
    });
  }
});

describe('browser input validation', () => {
  it.each([
    ['module', -1],
    ['module', NaN],
    ['torque', Infinity],
    ['teeth1', 23.5],
    ['teeth1', 7],
    ['teeth2', 121],
    ['width', 0],
    ['pressure_angle', 50],
    ['bore1', 44],
    ['profile1', 0.9],
    ['poisson_ratio', 0.5],
    ['rpm', -1],
  ] as [keyof Design, number][])('rejects %s=%s', (key, value) => {
    expect(() => calculate({ ...defaults, [key]: value })).toThrow();
  });
  it('does not mutate input parameters', () => {
    const p = Object.freeze({ ...defaults });
    calculate(p);
    expect(p).toEqual(defaults);
  });
});
