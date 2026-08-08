import { describe, expect, it } from 'vitest';

import {
  calculateBond,
  calculateInvestmentAmount,
  calculateInvestmentRemainder,
  calculatePresetYields,
  calculatePurchasableQuantity,
  combineHoldingPeriod,
  formatHoldingPeriod,
  formatPaymentFrequency,
} from '../index';

describe('bond calculation', () => {
  it('calculates coupon and price-adjusted annual yields', () => {
    const result = calculateBond({ nominal: 1000, purchasePrice: 950, quantity: 100, coupon: 45, paymentsPerYear: 2, holdingYears: 5, exitPrice: 1000 });
    expect(result.annualYield).toBeCloseTo(9.47, 2);
    expect(result.annualYieldWithPrice).toBeCloseTo(10.53, 2);
    expect(result.totalProfit).toBe(50000);
    expect(result.finalAmount).toBe(145000);
  });

  it('uses kopecks when synchronizing purchase fields', () => {
    expect(calculatePurchasableQuantity(1000, 333.33)).toBe(3);
    expect(calculateInvestmentAmount(333.33, 3)).toBe(999.99);
    expect(calculateInvestmentRemainder(1000, 333.33, 3)).toBeCloseTo(0.01);
    expect(calculateInvestmentRemainder(100, 150, 1)).toBeNull();
  });

  it('calculates saved preset yields for a sale', () => {
    const yields = calculatePresetYields({
      nominal: 1000, purchasePrice: 950, quantity: 100, coupon: 45, paymentsPerYear: 2,
      purchaseMode: 'quantity', investmentAmount: 95000, holdToMaturity: 'no', maturityDate: '',
      holdingYears: 5, holdingMonths: 0, salePrice: 1000,
    });
    expect(yields?.annualYield).toBeCloseTo(9.47, 2);
    expect(yields?.annualYieldWithPrice).toBeCloseTo(10.53, 2);
  });

  it('formats periods and payment frequency in Russian', () => {
    expect(combineHoldingPeriod(1, 6)).toBe(1.5);
    expect(formatHoldingPeriod(1)).toBe('1 год');
    expect(formatPaymentFrequency(2)).toBe('(каждые 6 месяцев)');
    expect(formatPaymentFrequency(12)).toBe('(каждый месяц)');
    expect(formatPaymentFrequency(5)).toBe('(каждые 2,4 месяца)');
  });
});
