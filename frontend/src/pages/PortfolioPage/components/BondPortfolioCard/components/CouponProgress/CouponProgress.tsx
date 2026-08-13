import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { formatDayCount, formatMoney } from '../../../../utils';
import styles from '../../BondPortfolioCard.module.scss';
import { couponProgress } from './utils';

interface CouponProgressProps {
  bond: BondPortfolioItem;
}

export function CouponProgress({ bond }: CouponProgressProps) {
  if (!bond.nextCoupon) {
    const label = bond.status === 'matured'
      ? 'Облигация погашена'
      : bond.status === 'payment_pending'
        ? 'Ожидается выплата'
        : 'Купонные выплаты не предусмотрены';

    return (
      <span className={`${styles.couponTrack} ${styles.redeemedTrack}`}>
        <span className={styles.couponCopy}>{label}</span>
      </span>
    );
  }

  const progress = couponProgress(bond.nextCoupon.periodDays, bond.nextCoupon.elapsedPeriodDays);
  const daysUntilCoupon = formatDayCount(bond.nextCoupon.daysUntil);

  return (
    <span
      className={styles.couponTrack}
      role="progressbar"
      aria-label={`Купонный период ${bond.name}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-valuetext={`Пройдено ${progress.toLocaleString('ru-RU')} %. Ближайший купон через ${daysUntilCoupon}, сумма ${formatMoney(bond.nextCoupon.amount)}`}
    >
      <span
        className={styles.couponFill}
        data-progress-fill
        aria-hidden="true"
        style={{ width: `${progress}%` }}
      />
      <span className={styles.couponCopy}>
        <span>Ближайший купон через {daysUntilCoupon}</span>
        <strong>{formatMoney(bond.nextCoupon.amount)}</strong>
      </span>
    </span>
  );
}
