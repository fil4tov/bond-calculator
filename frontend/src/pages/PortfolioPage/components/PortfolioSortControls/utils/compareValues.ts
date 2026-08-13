import type { PortfolioSortField, SortValue } from '../types';
import { nameCollator } from './constants';

export function compareValues(left: SortValue, right: SortValue, field: PortfolioSortField) {
  if (field === 'name') return nameCollator.compare(left as string, right as string);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
