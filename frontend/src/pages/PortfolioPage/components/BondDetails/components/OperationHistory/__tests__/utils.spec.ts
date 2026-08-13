import { describe, expect, it } from 'vitest';

import { formatOperationCount } from '../utils';

describe('OperationHistory utils', () => {
  it.each([
    [1, '1 операция'],
    [2, '2 операции'],
    [5, '5 операций'],
  ])('formats %i operations', (count, expected) => {
    expect(formatOperationCount(count)).toBe(expected);
  });
});
