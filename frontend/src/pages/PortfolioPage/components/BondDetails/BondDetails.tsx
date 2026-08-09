import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { formatDate, formatDayCount, formatMoney, formatPercent, formatYearCount } from '../../utils';
import styles from './BondDetails.module.scss';

function maturityValue(bond: BondPortfolioItem) {
  if (bond.status === 'matured') return 'Погашена';
  if (bond.status === 'payment_pending') return 'Ожидается выплата';
  const { years, months, daysUntil } = bond.maturityRemaining;
  return `${formatYearCount(years)} ${months} мес. · ${daysUntil.toLocaleString('ru-RU')} дн.`;
}

export function BondDetails({ bond }: { bond: BondPortfolioItem }) {
  const statusLabel = bond.status === 'matured'
    ? 'Погашена'
    : bond.status === 'payment_pending' ? 'Ожидается выплата' : 'Активна';
  const emptyCouponLabel = bond.status === 'matured'
    ? 'Облигация погашена'
    : bond.status === 'payment_pending'
      ? 'Ожидается выплата'
      : 'Купонные выплаты не предусмотрены';
  return (
    <div className={styles.details}>
      <span className={`${styles.status} ${bond.status === 'matured' ? styles.statusMatured : ''}`}>
        {statusLabel}
      </span>

      <dl className={styles.issueGrid}>
        <div><dt>Номинал</dt><dd>{formatMoney(bond.nominal)}</dd></div>
        <div><dt>Купон</dt><dd>{formatMoney(bond.couponAmount)}</dd></div>
        <div><dt>Выплат в год</dt><dd>{bond.paymentsPerYear}</dd></div>
        <div><dt>Купонный период</dt><dd>{bond.couponPeriodDays} дня</dd></div>
        <div><dt>Дата размещения</dt><dd>{formatDate(bond.placementDate)}</dd></div>
        <div><dt>Дата погашения</dt><dd>{formatDate(bond.maturityDate)}</dd></div>
      </dl>

      <dl className={styles.metricsGrid}>
        <div><dt>Вложенная сумма</dt><dd>{formatMoney(bond.totalSpent)}</dd></div>
        <div><dt>Количество</dt><dd>{bond.totalQuantity.toLocaleString('ru-RU')} шт.</dd></div>
        <div><dt>Годовая купонная доходность</dt><dd>{formatPercent(bond.annualCouponYieldPercent)}</dd></div>
        <div><dt>Выплачено купонов</dt><dd>{formatMoney(bond.paidCouponTotal)}</dd></div>
        <div><dt>Срок до погашения</dt><dd>{maturityValue(bond)}</dd></div>
      </dl>

      {bond.nextCoupon ? (
        <section className={styles.nextCoupon} aria-label="Ближайший купон">
          <span>Ближайший купон</span>
          <strong>{formatMoney(bond.nextCoupon.amount)}</strong>
          <p>{formatDate(bond.nextCoupon.payDate)} · через {formatDayCount(bond.nextCoupon.daysUntil)}</p>
          <p>
            Купонный период: {formatDate(bond.nextCoupon.periodStart)} — {formatDate(bond.nextCoupon.periodEnd)}
          </p>
        </section>
      ) : (
        <section className={`${styles.nextCoupon} ${styles.redeemedCoupon}`}>{emptyCouponLabel}</section>
      )}
    </div>
  );
}
