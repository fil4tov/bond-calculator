import type { BondPortfolioItem } from '#entities/bondPortfolio';

import type { PortfolioSortField, SortValue } from '../types';
import { firstPurchaseDate } from './firstPurchaseDate';
import { moneyToKopecks } from './moneyToKopecks';

export function getSortValue(bond: BondPortfolioItem, field: PortfolioSortField): SortValue | null {
  switch (field) {
    case 'name':
      return bond.name;
    case 'createdAt':
      return Date.parse(bond.createdAt);
    case 'nextCoupon':
      return bond.nextCoupon?.payDate ?? null;
    case 'firstPurchase':
      return firstPurchaseDate(bond);
    case 'portfolioShare':
      return moneyToKopecks(bond.marketValueWithoutAci);
  }
}
