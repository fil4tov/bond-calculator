import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { formatDate, formatDayCount, formatMoney, formatPercent, formatYearCount } from '../../utils';
import styles from './BondDetails.module.scss';

function maturityValue(bond: BondPortfolioItem) {
  if (bond.status === 'matured') return 'Погашена';
  if (bond.status === 'payment_pending') return 'Ожидается выплата';
  const { years, months, daysUntil } = bond.maturityRemaining;
  return `${formatYearCount(years)} ${months} мес. · ${daysUntil.toLocaleString('ru-RU')} дн.`;
}

function formatPurchaseCount(count: number) {
  const category = new Intl.PluralRules('ru-RU').select(count);
  const label = category === 'one' ? 'покупка' : category === 'few' ? 'покупки' : 'покупок';
  return `${count.toLocaleString('ru-RU')} ${label}`;
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
        <div><dt>Выплат в год</dt><dd>{bond.paymentsPerYear}</dd></div>
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
          <span className={styles.nextCouponLabel}>Ближайший купон</span>
          <div className={styles.couponAmounts}>
            <strong>{formatMoney(bond.nextCoupon.amount)}</strong>
            <span className={styles.amountSeparator} aria-hidden="true">•</span>
            <b>{formatMoney(bond.nextCoupon.amountPerBond)} шт.</b>
          </div>
          <p>{formatDate(bond.nextCoupon.payDate)} · через {formatDayCount(bond.nextCoupon.daysUntil)}</p>
        </section>
      ) : (
        <section className={`${styles.nextCoupon} ${styles.redeemedCoupon}`}>{emptyCouponLabel}</section>
      )}

      <section className={styles.purchaseHistory} aria-label="История покупок">
        <div className={styles.purchaseHistoryHeading}>
          <h3>История покупок</h3>
          <span>{formatPurchaseCount(bond.purchases.length)}</span>
        </div>
        <ol className={styles.purchaseTimeline}>
          {bond.purchases.map((purchase) => (
            <li key={purchase.id} className={styles.purchaseItem}>
              <span className={styles.timelineMarker} aria-hidden="true" />
              <div className={styles.purchaseData}>
                <strong>{formatMoney(purchase.amountSpent)}</strong>
                <span>{purchase.quantity.toLocaleString('ru-RU')} шт.</span>
              </div>
              <time dateTime={purchase.purchaseDate}>{formatDate(purchase.purchaseDate)}</time>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
