import type { BondPortfolioItem } from '#entities/bondPortfolio';

export type PortfolioSortField = 'name' | 'createdAt' | 'nextCoupon' | 'firstPurchase' | 'portfolioShare';
export type SortDirection = 'asc' | 'desc';

export interface PortfolioSortPreference {
  field: PortfolioSortField;
  direction: SortDirection;
}

interface StoredPortfolioSortPreference extends PortfolioSortPreference {
  version: 1;
}

export const DEFAULT_PORTFOLIO_SORT: PortfolioSortPreference = {
  field: 'createdAt',
  direction: 'desc',
};

const SORT_FIELDS: readonly PortfolioSortField[] = ['name', 'createdAt', 'nextCoupon', 'firstPurchase', 'portfolioShare'];
const SORT_DIRECTIONS: readonly SortDirection[] = ['asc', 'desc'];
const nameCollator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

export const getPortfolioSortStorageKey = (userId: string) => `bond-portfolio-sort:${userId}`;

const getBrowserStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const isStoredPreference = (value: unknown): value is StoredPortfolioSortPreference => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredPortfolioSortPreference>;
  return candidate.version === 1
    && SORT_FIELDS.includes(candidate.field as PortfolioSortField)
    && SORT_DIRECTIONS.includes(candidate.direction as SortDirection);
};

export function readPortfolioSortPreference(userId: string, storage?: Storage | null): PortfolioSortPreference {
  try {
    const raw = (storage === undefined ? getBrowserStorage() : storage)?.getItem(getPortfolioSortStorageKey(userId));
    if (!raw) return { ...DEFAULT_PORTFOLIO_SORT };
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredPreference(parsed)) return { ...DEFAULT_PORTFOLIO_SORT };
    return { field: parsed.field, direction: parsed.direction };
  } catch {
    return { ...DEFAULT_PORTFOLIO_SORT };
  }
}

export function writePortfolioSortPreference(
  userId: string,
  preference: PortfolioSortPreference,
  storage?: Storage | null,
) {
  try {
    const stored: StoredPortfolioSortPreference = { version: 1, ...preference };
    (storage === undefined ? getBrowserStorage() : storage)?.setItem(
      getPortfolioSortStorageKey(userId),
      JSON.stringify(stored),
    );
  } catch {
    // Storage can be blocked or full; sorting still works for the current session.
  }
}

const firstPurchaseDate = (bond: BondPortfolioItem): string | null => {
  let earliest: string | null = null;
  for (const operation of bond.operations) {
    if (operation.operationType !== 'purchase') continue;
    if (earliest === null || operation.operationDate < earliest) earliest = operation.operationDate;
  }
  return earliest;
};

const moneyToKopecks = (value: string | null): bigint | null => {
  if (value === null) return null;
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const sign = match[1] ?? '';
  const rubles = match[2]!;
  const fraction = match[3] ?? '';
  const kopecks = BigInt(rubles) * 100n + BigInt(fraction.padEnd(2, '0'));
  return sign === '-' ? -kopecks : kopecks;
};

type SortValue = string | number | bigint;

const getSortValue = (bond: BondPortfolioItem, field: PortfolioSortField): SortValue | null => {
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
};

const compareValues = (left: SortValue, right: SortValue, field: PortfolioSortField) => {
  if (field === 'name') return nameCollator.compare(left as string, right as string);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const compareTieBreakers = (left: BondPortfolioItem, right: BondPortfolioItem) => {
  const byName = nameCollator.compare(left.name, right.name);
  if (byName !== 0) return byName;
  return left.id.localeCompare(right.id);
};

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
      if (primary !== 0) return preference.direction === 'asc' ? primary : -primary;
    }

    return compareTieBreakers(left, right);
  });
}
