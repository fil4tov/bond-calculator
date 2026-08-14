import type { BondPortfolioItem } from '#entities/bondPortfolio';

export function firstPurchaseDate(bond: BondPortfolioItem): string | null {
  let earliest: string | null = null;
  for (const operation of bond.operations) {
    if (operation.operationType !== 'purchase') continue;
    if (earliest === null || operation.operationDate < earliest) earliest = operation.operationDate;
  }
  return earliest;
}
