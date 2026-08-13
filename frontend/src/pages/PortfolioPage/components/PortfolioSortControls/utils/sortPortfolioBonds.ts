import type { BondPortfolioItem } from '#entities/bondPortfolio';

import type { PortfolioSortPreference } from '../types';
import { compareTieBreakers } from './compareTieBreakers';
import { compareValues } from './compareValues';
import { getSortValue } from './getSortValue';

export function sortPortfolioBonds(
  bonds: readonly BondPortfolioItem[],
  preference: PortfolioSortPreference,
): BondPortfolioItem[] {
  return [...bonds].sort((left, right) => {
    const leftValue = getSortValue(left, preference.field);
    const rightValue = getSortValue(right, preference.field);

    if (leftValue === null && rightValue !== null) return 1;
    if (leftValue !== null && rightValue === null) return -1;
    if (leftValue !== null && rightValue !== null) {
      const primary = compareValues(leftValue, rightValue, preference.field);
      if (primary !== 0) {
        const invertedDirection = preference.field === 'name'
          || preference.field === 'nextCoupon'
          || preference.field === 'firstPurchase';
        const ascendingValues = invertedDirection
          ? preference.direction === 'desc'
          : preference.direction === 'asc';
        return ascendingValues ? primary : -primary;
      }
    }

    return compareTieBreakers(left, right);
  });
}
