import type { BondPortfolioItem } from '#entities/bondPortfolio';

import styles from '../../BondDetails.module.scss';

export function BondStatus({ bond }: { bond: BondPortfolioItem }) {
  const statusLabel = bond.status === 'matured'
    ? 'Погашена'
    : bond.status === 'payment_pending' ? 'Ожидается выплата' : 'Активна';

  return (
    <span className={`${styles.status} ${bond.status === 'matured' ? styles.statusMatured : ''}`}>
      {statusLabel}
    </span>
  );
}

