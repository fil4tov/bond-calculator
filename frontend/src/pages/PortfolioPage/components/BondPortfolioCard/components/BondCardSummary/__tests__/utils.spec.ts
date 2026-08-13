import { describe, expect, it } from 'vitest';

import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { maturityLabel } from '../utils';

describe('BondCardSummary utils', () => {
  it('formats active and terminal maturity states', () => {
    expect(maturityLabel({ status: 'matured' } as BondPortfolioItem)).toBe('Погашена');
    expect(maturityLabel({ status: 'payment_pending' } as BondPortfolioItem)).toBe('Ожидается выплата');
    expect(maturityLabel({
      status: 'active',
      maturityRemaining: { years: 0, months: 0, daysUntil: 12 },
    } as BondPortfolioItem)).toBe('До погашения 12 дн.');
  });
});
