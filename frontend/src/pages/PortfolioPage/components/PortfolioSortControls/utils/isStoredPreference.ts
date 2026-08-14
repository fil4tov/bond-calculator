import type { PortfolioSortField, SortDirection, StoredPortfolioSortPreference } from '../types';
import { SORT_DIRECTIONS, SORT_FIELDS } from './constants';

export function isStoredPreference(value: unknown): value is StoredPortfolioSortPreference {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredPortfolioSortPreference>;
  return candidate.version === 1
    && SORT_FIELDS.includes(candidate.field as PortfolioSortField)
    && SORT_DIRECTIONS.includes(candidate.direction as SortDirection);
}
