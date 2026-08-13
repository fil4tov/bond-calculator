import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { formatYearCount } from '../../../../utils';

export function maturityValue(bond: BondPortfolioItem) {
  if (bond.status === 'matured') return 'Погашена';
  if (bond.status === 'payment_pending') return 'Ожидается выплата';
  const { years, months, daysUntil } = bond.maturityRemaining;
  return `${formatYearCount(years)} ${months} мес. · ${daysUntil.toLocaleString('ru-RU')} дн.`;
}
