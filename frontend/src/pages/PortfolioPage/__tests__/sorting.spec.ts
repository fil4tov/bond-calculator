import { beforeEach, describe, expect, it } from 'vitest';

import type { BondPortfolioItem } from '#entities/bondPortfolio';

import {
  DEFAULT_PORTFOLIO_SORT,
  getPortfolioSortStorageKey,
  readPortfolioSortPreference,
  sortPortfolioBonds,
  writePortfolioSortPreference,
} from '../sorting';

const makeBond = (overrides: Partial<BondPortfolioItem> = {}): BondPortfolioItem => ({
  id: 'bond-1',
  createdAt: '2026-08-01T10:00:00Z',
  name: 'Облигация 1',
  nominal: '1000.00',
  paymentsPerYear: 2,
  placementDate: '2025-01-01',
  maturityDate: '2030-01-01',
  status: 'active',
  totalQuantity: 1,
  totalSpent: '1000.00',
  positionCostBasis: '1000.00',
  marketValueWithoutAci: '1000.00',
  accruedCouponIncome: '12.34',
  realizedResult: '0.00',
  positionStatus: 'open',
  paidCouponTotal: '0.00',
  calendarYearCouponYieldPercent: '0.0000',
  annualCouponYieldPercent: '0.0000',
  calendarYearCouponIncome: '0.00',
  couponYieldYear: 2026,
  maturityRemaining: { years: 3, months: 4, daysUntil: 1200 },
  nextCoupon: {
    periodStart: '2026-01-01',
    periodEnd: '2026-09-01',
    payDate: '2026-09-02',
    amount: '10.00',
    amountPerBond: '10.00',
    daysUntil: 21,
    periodDays: 244,
    elapsedPeriodDays: 223,
  },
  operations: [
    { id: 'purchase-1', operationType: 'purchase', amount: '1000.00', quantity: 1, operationDate: '2026-07-01', realizedResult: null },
  ],
  ...overrides,
});

describe('portfolio sorting', () => {
  beforeEach(() => localStorage.clear());

  it('sorts newest additions first by default without mutating the query data', () => {
    const older = makeBond({ id: 'older', createdAt: '2026-08-01T10:00:00Z' });
    const newer = makeBond({ id: 'newer', createdAt: '2026-08-02T10:00:00Z' });
    const source = [older, newer];

    expect(sortPortfolioBonds(source, DEFAULT_PORTFOLIO_SORT)).toEqual([newer, older]);
    expect(source).toEqual([older, newer]);
  });

  it('uses Russian numeric name ordering in both directions', () => {
    const second = makeBond({ id: '2', name: 'ОФЗ 2' });
    const tenth = makeBond({ id: '10', name: 'ОФЗ 10' });

    expect(sortPortfolioBonds([tenth, second], { field: 'name', direction: 'asc' })).toEqual([tenth, second]);
    expect(sortPortfolioBonds([second, tenth], { field: 'name', direction: 'desc' })).toEqual([second, tenth]);
  });

  it('sorts coupon dates and keeps missing coupons last in either direction', () => {
    const early = makeBond({ id: 'early', nextCoupon: { ...makeBond().nextCoupon!, payDate: '2026-09-01' } });
    const late = makeBond({ id: 'late', nextCoupon: { ...makeBond().nextCoupon!, payDate: '2026-10-01' } });
    const missing = makeBond({ id: 'missing', nextCoupon: null });

    expect(sortPortfolioBonds([missing, late, early], { field: 'nextCoupon', direction: 'asc' })).toEqual([late, early, missing]);
    expect(sortPortfolioBonds([missing, early, late], { field: 'nextCoupon', direction: 'desc' })).toEqual([early, late, missing]);
  });

  it('sorts by the earliest purchase and keeps bonds without purchases last', () => {
    const first = makeBond({
      id: 'first',
      operations: [
        { id: 'sale', operationType: 'sale', amount: '500.00', quantity: 1, operationDate: '2026-01-01', realizedResult: '0.00' },
        { id: 'purchase-later', operationType: 'purchase', amount: '500.00', quantity: 1, operationDate: '2026-06-01', realizedResult: null },
        { id: 'purchase-first', operationType: 'purchase', amount: '500.00', quantity: 1, operationDate: '2025-06-01', realizedResult: null },
      ],
    });
    const second = makeBond({ id: 'second', operations: [{ id: 'purchase', operationType: 'purchase', amount: '500.00', quantity: 1, operationDate: '2026-01-01', realizedResult: null }] });
    const missing = makeBond({ id: 'missing', operations: [{ id: 'sale', operationType: 'sale', amount: '500.00', quantity: 1, operationDate: '2024-01-01', realizedResult: '0.00' }] });

    expect(sortPortfolioBonds([missing, second, first], { field: 'firstPurchase', direction: 'asc' })).toEqual([second, first, missing]);
    expect(sortPortfolioBonds([missing, first, second], { field: 'firstPurchase', direction: 'desc' })).toEqual([first, second, missing]);
  });

  it('compares portfolio values as exact kopecks and keeps missing values last', () => {
    const lower = makeBond({ id: 'lower', marketValueWithoutAci: '9007199254740993.01' });
    const higher = makeBond({ id: 'higher', marketValueWithoutAci: '9007199254740993.02' });
    const missing = makeBond({ id: 'missing', marketValueWithoutAci: null });

    expect(sortPortfolioBonds([higher, missing, lower], { field: 'portfolioShare', direction: 'asc' })).toEqual([lower, higher, missing]);
    expect(sortPortfolioBonds([lower, missing, higher], { field: 'portfolioShare', direction: 'desc' })).toEqual([higher, lower, missing]);
  });

  it('breaks equal values by name and then id independent of direction', () => {
    const beta = makeBond({ id: '2', name: 'Бета', createdAt: '2026-08-01T10:00:00Z' });
    const alphaSecond = makeBond({ id: '2', name: 'Альфа', createdAt: '2026-08-01T10:00:00Z' });
    const alphaFirst = makeBond({ id: '1', name: 'Альфа', createdAt: '2026-08-01T10:00:00Z' });

    expect(sortPortfolioBonds([beta, alphaSecond, alphaFirst], { field: 'createdAt', direction: 'desc' })).toEqual([alphaFirst, alphaSecond, beta]);
  });
});

describe('portfolio sort storage', () => {
  beforeEach(() => localStorage.clear());

  it('stores and restores a versioned preference per user', () => {
    writePortfolioSortPreference('user-1', { field: 'name', direction: 'asc' });

    expect(localStorage.getItem(getPortfolioSortStorageKey('user-1'))).toBe('{"version":1,"field":"name","direction":"asc"}');
    expect(readPortfolioSortPreference('user-1')).toEqual({ field: 'name', direction: 'asc' });
    expect(readPortfolioSortPreference('user-2')).toEqual(DEFAULT_PORTFOLIO_SORT);
  });

  it('falls back for corrupted, obsolete or unavailable storage', () => {
    localStorage.setItem(getPortfolioSortStorageKey('user-1'), '{broken');
    expect(readPortfolioSortPreference('user-1')).toEqual(DEFAULT_PORTFOLIO_SORT);

    localStorage.setItem(getPortfolioSortStorageKey('user-1'), '{"version":2,"field":"name","direction":"asc"}');
    expect(readPortfolioSortPreference('user-1')).toEqual(DEFAULT_PORTFOLIO_SORT);

    const unavailableStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    } as unknown as Storage;
    expect(readPortfolioSortPreference('user-1', unavailableStorage)).toEqual(DEFAULT_PORTFOLIO_SORT);
    expect(() => writePortfolioSortPreference('user-1', { field: 'name', direction: 'asc' }, unavailableStorage)).not.toThrow();
  });
});
