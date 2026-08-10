import { describe, expect, it } from 'vitest';

import { containsDisallowedMinus, formatInputNumber, isValidNumericDraft, parseFormattedNumber } from '../index';

describe('formatted numbers', () => {
  it('accepts decimal drafts and grouping spaces', () => {
    expect(isValidNumericDraft('950,')).toBe(true);
    expect(isValidNumericDraft('1 083,22')).toBe(true);
    expect(isValidNumericDraft('950..')).toBe(false);
    expect(containsDisallowedMinus('−')).toBe(true);
  });

  it('parses and formats Russian numbers', () => {
    expect(parseFormattedNumber('1\u00a0083,22')).toBe(1083.22);
    expect(formatInputNumber(95000)).toMatch(/^95[\s\u00a0\u202f]000$/);
  });
});
