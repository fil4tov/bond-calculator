export type PortfolioSortField = 'name' | 'createdAt' | 'nextCoupon' | 'firstPurchase' | 'portfolioShare';
export type SortDirection = 'asc' | 'desc';

export interface PortfolioSortPreference {
  field: PortfolioSortField;
  direction: SortDirection;
}

export interface StoredPortfolioSortPreference extends PortfolioSortPreference {
  version: 1;
}

export type SortValue = string | number | bigint;
