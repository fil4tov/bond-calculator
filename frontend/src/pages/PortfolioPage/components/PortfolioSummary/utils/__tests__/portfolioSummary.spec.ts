import { describe, expect, it } from 'vitest';

import { calculatePortfolioSummary } from '..';

const openBond = {
  positionStatus: 'open' as const,
  marketValueWithoutAci: '74250.00',
  accruedCouponIncome: '925.93',
  positionCostBasis: '75000.70',
  paidCouponTotal: '5900.00',
  calendarYearPaidCouponIncome: '1770.00',
  calendarYearCouponIncome: '4248.00',
  calendarMonthCouponIncome: '0.00',
  couponYieldYear: 2026,
};

describe('calculatePortfolioSummary', () => {
  it('aggregates open positions and preserves coupons from closed issues', () => {
    const summary = calculatePortfolioSummary([
      openBond,
      {
        ...openBond,
        positionStatus: 'closed',
        marketValueWithoutAci: '0.00',
        accruedCouponIncome: '0.00',
        positionCostBasis: '0.00',
        paidCouponTotal: '825.15',
        calendarYearPaidCouponIncome: '230.05',
        calendarYearCouponIncome: '230.05',
        calendarMonthCouponIncome: '100.10',
      },
    ]);

    expect(summary).toEqual({
      marketValue: '75175.93',
      investedAmount: '75000.70',
      openIssueCount: 1,
      currentResult: '175.23',
      couponReceived: '2000.05',
      couponReceivedTotal: '6725.15',
      couponExpected: '4478.05',
      couponMonth: '100.10',
      couponProgress: 44.66,
      couponYear: 2026,
    });
  });

  it('returns unavailable market totals when one open issue has no market price', () => {
    const summary = calculatePortfolioSummary([
      openBond,
      { ...openBond, marketValueWithoutAci: null },
    ]);

    expect(summary.marketValue).toBeNull();
    expect(summary.currentResult).toBeNull();
    expect(summary.investedAmount).toBe('150001.40');
    expect(summary.openIssueCount).toBe(2);
  });

  it('uses zero progress when no coupons are expected', () => {
    const summary = calculatePortfolioSummary([{
      ...openBond,
      calendarYearPaidCouponIncome: '0.00',
      calendarYearCouponIncome: '0.00',
    }]);

    expect(summary.couponProgress).toBe(0);
  });
});
