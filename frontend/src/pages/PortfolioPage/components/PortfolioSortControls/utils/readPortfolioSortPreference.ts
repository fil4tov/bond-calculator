import type { PortfolioSortPreference } from '../types';
import { DEFAULT_PORTFOLIO_SORT } from './constants';
import { getBrowserStorage } from './getBrowserStorage';
import { getPortfolioSortStorageKey } from './getPortfolioSortStorageKey';
import { isStoredPreference } from './isStoredPreference';

export function readPortfolioSortPreference(
  userId: string,
  storage?: Storage | null,
): PortfolioSortPreference {
  try {
    const targetStorage = storage === undefined ? getBrowserStorage() : storage;
    const raw = targetStorage?.getItem(getPortfolioSortStorageKey(userId));
    if (!raw) return { ...DEFAULT_PORTFOLIO_SORT };
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredPreference(parsed)) return { ...DEFAULT_PORTFOLIO_SORT };
    return { field: parsed.field, direction: parsed.direction };
  } catch {
    return { ...DEFAULT_PORTFOLIO_SORT };
  }
}
