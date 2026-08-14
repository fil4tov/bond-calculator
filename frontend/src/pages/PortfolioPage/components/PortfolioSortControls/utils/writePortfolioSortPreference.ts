import type { PortfolioSortPreference, StoredPortfolioSortPreference } from '../types';
import { getBrowserStorage } from './getBrowserStorage';
import { getPortfolioSortStorageKey } from './getPortfolioSortStorageKey';

export function writePortfolioSortPreference(
  userId: string,
  preference: PortfolioSortPreference,
  storage?: Storage | null,
) {
  try {
    const stored: StoredPortfolioSortPreference = { version: 1, ...preference };
    const targetStorage = storage === undefined ? getBrowserStorage() : storage;
    targetStorage?.setItem(getPortfolioSortStorageKey(userId), JSON.stringify(stored));
  } catch {
    // Storage can be blocked or full; sorting still works for the current session.
  }
}
