import { describe, expect, it } from 'vitest';

import { groupCouponPaymentsByYear } from '../utils';

describe('groupCouponPaymentsByYear', () => {
  it('sorts years and payments newest first and sums money exactly', () => {
    expect(groupCouponPaymentsByYear([
      { couponNumber: 30, payDate: '2025-08-16', amountPerBond: '35.40', quantity: 60, amount: '2124.00' },
      { couponNumber: 34, payDate: '2026-08-15', amountPerBond: '35.40', quantity: 75, amount: '2655.00' },
      { couponNumber: 33, payDate: '2026-05-16', amountPerBond: '35.40', quantity: 75, amount: '2655.00' },
    ])).toEqual([
      {
        year: 2026,
        total: '5310.00',
        payments: [
          { couponNumber: 34, payDate: '2026-08-15', amountPerBond: '35.40', quantity: 75, amount: '2655.00' },
          { couponNumber: 33, payDate: '2026-05-16', amountPerBond: '35.40', quantity: 75, amount: '2655.00' },
        ],
      },
      {
        year: 2025,
        total: '2124.00',
        payments: [
          { couponNumber: 30, payDate: '2025-08-16', amountPerBond: '35.40', quantity: 60, amount: '2124.00' },
        ],
      },
    ]);
  });
});
