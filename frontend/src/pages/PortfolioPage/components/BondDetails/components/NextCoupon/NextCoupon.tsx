import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { formatDate, formatDayCount, formatMoney } from '../../../../utils';
import styles from '../../BondDetails.module.scss';

export function NextCoupon({ bond }: { bond: BondPortfolioItem }) {
  if (!bond.nextCoupon) {
    const emptyLabel = bond.status === 'matured'
      ? 'Облигация погашена'
      : bond.status === 'payment_pending'
        ? 'Ожидается выплата'
        : 'Купонные выплаты не предусмотрены';

    return <section className={`${styles.nextCoupon} ${styles.redeemedCoupon}`}>{emptyLabel}</section>;
  }

  return (
    <section className={styles.nextCoupon} aria-label="Ближайший купон">
      <span className={styles.nextCouponLabel}>Ближайший купон</span>
      <div className={styles.couponAmounts}>
        <strong>{formatMoney(bond.nextCoupon.amount)}</strong>
        <span className={styles.amountSeparator} aria-hidden="true">•</span>
        <b>{formatMoney(bond.nextCoupon.amountPerBond)} шт.</b>
      </div>
      <p>{formatDate(bond.nextCoupon.payDate)} · через {formatDayCount(bond.nextCoupon.daysUntil)}</p>
    </section>
  );
}
