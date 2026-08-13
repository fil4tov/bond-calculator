import type { PortfolioSortField } from '../../types';

export const SORT_OPTIONS: ReadonlyArray<{ field: PortfolioSortField; label: string }> = [
  { field: 'name', label: 'По имени' },
  { field: 'createdAt', label: 'По дате добавления' },
  { field: 'nextCoupon', label: 'По ближайшей выплате купона' },
  { field: 'firstPurchase', label: 'По дате первой покупки' },
  { field: 'portfolioShare', label: 'По доле портфеля' },
];
