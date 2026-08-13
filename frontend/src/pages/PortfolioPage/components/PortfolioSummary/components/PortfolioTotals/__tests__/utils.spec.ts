import { describe, expect, it } from 'vitest';

import { resultClassName } from '../utils';

describe('PortfolioTotals utils', () => {
  it('maps null and zero to the same neutral class', () => {
    expect(resultClassName(null)).toBe(resultClassName('0.00'));
    expect(resultClassName('-1')).not.toBe(resultClassName('1'));
  });
});
