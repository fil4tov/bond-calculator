import { describe, expect, it } from 'vitest';

import { formatOperationResult, resultSign } from '..';

describe('BondDetails utils', () => {
  it.each([
    ['0.00', 'zero'],
    ['-0.00', 'zero'],
    ['-1', 'negative'],
    ['1', 'positive'],
  ] as const)('classifies %s as %s', (value, expected) => {
    expect(resultSign(value)).toBe(expected);
  });

  it('prefixes only positive operation results', () => {
    expect(formatOperationResult('10')).toMatch(/^\+/);
    expect(formatOperationResult('-10')).not.toMatch(/^\+/);
    expect(formatOperationResult('0')).not.toMatch(/^\+/);
  });
});
