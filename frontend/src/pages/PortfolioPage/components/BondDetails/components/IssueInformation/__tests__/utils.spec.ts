import { describe, expect, it } from 'vitest';

import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { maturityValue } from '../utils';

describe('IssueInformation utils', () => {
  it('uses dedicated maturity labels for terminal statuses', () => {
    expect(maturityValue({ status: 'matured' } as BondPortfolioItem)).toBe('Погашена');
    expect(maturityValue({ status: 'payment_pending' } as BondPortfolioItem)).toBe('Ожидается выплата');
    expect(maturityValue({
      status: 'active',
      maturityRemaining: { years: 2, months: 3, daysUntil: 820 },
    } as BondPortfolioItem)).toContain('820 дн.');
  });
});
