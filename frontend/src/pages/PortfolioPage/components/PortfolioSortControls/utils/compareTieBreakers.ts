import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { nameCollator } from './constants';

export function compareTieBreakers(left: BondPortfolioItem, right: BondPortfolioItem) {
  const byName = nameCollator.compare(left.name, right.name);
  if (byName !== 0) return byName;
  return left.id.localeCompare(right.id);
}
