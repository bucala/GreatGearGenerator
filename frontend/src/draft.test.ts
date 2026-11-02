import { describe, expect, it } from 'vitest';
import { parseDraft } from './App';
import { defaults } from './types';

const draft = Object.fromEntries(
  Object.entries(defaults).map(([k, v]) => [k, String(v)]),
) as Record<keyof typeof defaults, string>;
describe('parameter draft', () => {
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
