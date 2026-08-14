import { describe, expect, it } from 'vitest';

import { couponProgress } from '../utils';

describe('CouponProgress utils', () => {
  it.each([
    [100, 50, 50],
    [0, 50, 0],
    [100, 150, 100],
    [100, -10, 0],
    [3, 1, 33.33],
  ])('calculates coupon progress for %i/%i', (periodDays, elapsedDays, expected) => {
    expect(couponProgress(periodDays, elapsedDays)).toBe(expected);
  });
});
