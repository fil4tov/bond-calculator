import { describe, expect, it } from 'vitest';

import { groupCouponScheduleByYear, isZeroMoney } from '../utils';

describe('coupon schedule utils', () => {
  it('groups newest events first and sums money exactly', () => {
    expect(groupCouponScheduleByYear([
      { couponNumber: 1, payDate: '2025-05-01', amountPerBond: '10.00', quantity: 0, amount: '0.00' },
      { couponNumber: 3, payDate: '2026-11-01', amountPerBond: '10.00', quantity: 2, amount: '20.00' },
      { couponNumber: 2, payDate: '2026-05-01', amountPerBond: '10.00', quantity: 1, amount: '10.05' },
    ])).toEqual([
      {
        year: 2026,
        events: [
          { couponNumber: 3, payDate: '2026-11-01', amountPerBond: '10.00', quantity: 2, amount: '20.00' },
          { couponNumber: 2, payDate: '2026-05-01', amountPerBond: '10.00', quantity: 1, amount: '10.05' },
        ],
        total: '30.05',
      },
      {
        year: 2025,
        events: [
          { couponNumber: 1, payDate: '2025-05-01', amountPerBond: '10.00', quantity: 0, amount: '0.00' },
        ],
        total: '0.00',
      },
    ]);
  });

  it('recognizes canonical zero money values', () => {
    expect(isZeroMoney('0.00')).toBe(true);
    expect(isZeroMoney('0')).toBe(true);
    expect(isZeroMoney('0.01')).toBe(false);
  });
});
