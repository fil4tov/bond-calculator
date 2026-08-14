import type { PortfolioSortField, PortfolioSortPreference, SortDirection } from '../types';

export const DEFAULT_PORTFOLIO_SORT: PortfolioSortPreference = {
  field: 'createdAt',
  direction: 'desc',
};

export const SORT_FIELDS: readonly PortfolioSortField[] = [
  'name',
  'createdAt',
  'nextCoupon',
  'firstPurchase',
  'portfolioShare',
];

export const SORT_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];
export const nameCollator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });
