import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { formatYearCount } from '../../../../utils';

export function maturityLabel(bond: BondPortfolioItem) {
  if (bond.status === 'matured') return 'Погашена';
  if (bond.status === 'payment_pending') return 'Ожидается выплата';
  const { years, months, daysUntil } = bond.maturityRemaining;
  if (years > 0) return `До погашения ${formatYearCount(years)} ${months} мес.`;
  if (months > 0) return `До погашения ${months} мес.`;
  return `До погашения ${daysUntil.toLocaleString('ru-RU')} дн.`;
}
