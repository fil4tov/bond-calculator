import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BondCalculatorFormValues } from '../../../../types';
import {
  formatted,
  getDefaultMaturityDate,
  getDefaultValues,
  getTomorrow,
  toLocalDateInputValue,
  validateCalculation,
} from '..';

const validValues: BondCalculatorFormValues = {
  bondName: '',
  nominal: '1 000',
  purchasePrice: '950',
  coupon: '45',
  paymentsPerYear: '2',
  purchaseMode: 'quantity',
  quantity: '100',
  investmentAmount: '95 000',
  holdToMaturity: 'yes',
  maturityDate: '2031-08-14',
  holdingYears: '5',
  holdingMonths: '0',
  salePrice: '1 000',
};

describe('BondCalculatorForm utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 14, 12));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats local input dates without a UTC shift', () => {
    expect(toLocalDateInputValue(new Date(2026, 7, 4))).toBe('2026-08-04');
    expect(getTomorrow()).toBe('2026-08-15');
    expect(getDefaultMaturityDate()).toBe('2031-08-14');
  });

  it('builds the same valid defaults used by the form', () => {
    expect(formatted(1000)).toMatch(/^1\s000$/);
    expect(getDefaultValues()).toMatchObject({
      nominal: expect.stringMatching(/^1\s000$/),
      purchaseMode: 'quantity',
      holdToMaturity: 'yes',
      maturityDate: '2031-08-14',
    });
  });

  it('returns calculation input for valid values', () => {
    const validation = validateCalculation(validValues);

    expect(validation.errors).toEqual({});
    expect(validation.input).toMatchObject({
      nominal: 1000,
      purchasePrice: 950,
      quantity: 100,
      coupon: 45,
      paymentsPerYear: 2,
      exitPrice: 1000,
    });
    expect(validation.input?.holdingYears).toBeCloseTo(5, 2);
  });

  it('rejects invalid nominal and zero holding period', () => {
    const validation = validateCalculation({
      ...validValues,
      nominal: '0',
      holdToMaturity: 'no',
      holdingYears: '0',
      holdingMonths: '0',
    });

    expect(validation.input).toBeNull();
    expect(validation.errors).toMatchObject({
      nominal: expect.any(String),
      holdingYears: expect.any(String),
    });
  });
});
