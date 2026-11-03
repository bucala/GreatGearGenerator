import { describe, expect, it } from 'vitest';
import { parseDraft } from './App';
import { defaults } from './types';

const draft = Object.fromEntries(
  Object.entries(defaults).map(([k, v]) => [k, String(v)]),
) as Record<keyof typeof defaults, string>;
describe('parameter draft', () => {
  it('ignores inactive radius fields but requires valid active manual fields', () => {
    expect(parseDraft({ ...draft, root_radius: '' })).not.toBeNull();
    expect(
      parseDraft({ ...draft, manual_radii: '1', root_fillet: '1', root_radius: '' }),
    ).toBeNull();
    const parsed = parseDraft({
      ...draft,
      manual_radii: '1',
      root_fillet: '1',
      root_radius: '0.375',
      tip_radius: '',
    });
    expect(parsed?.root_radius).toBe(0.375);
    expect(parsed?.tip_radius).toBe(0);
  });
  it('preserves all parameters without rounding', () => {
    expect(parseDraft({ ...draft, profile1: '0.125' })).toEqual({ ...defaults, profile1: 0.125 });
  });
  it.each(['', ' ', 'NaN', 'Infinity', 'abc'])(
    'does not coerce invalid input %s into zero',
    (value) => {
      expect(parseDraft({ ...draft, module: value })).toBeNull();
    },
  );
});
