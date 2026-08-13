import { formatMoney } from '../../../../utils';
import styles from '../../PortfolioSummary.module.scss';
import type { PortfolioSummaryData } from '../../types';
import { signedMoney } from '../../utils';

export function CouponTotals({ summary }: { summary: PortfolioSummaryData }) {
  return (
    <div className={styles.couponCard}>
      <dl className={styles.couponMetrics} aria-label="Информация по купонам">
        <div className={styles.couponMetric}>
          <dt>Получено купонами за {summary.couponYear} год</dt>
          <dd className={styles.positive}><strong>{signedMoney(summary.couponReceived)}</strong></dd>
        </div>
        <div className={styles.couponMetric}>
          <dt>Всего ожидается за {summary.couponYear} год</dt>
          <dd><strong>{formatMoney(summary.couponExpected)}</strong></dd>
        </div>
        <div className={styles.couponMetric}>
          <dt>Выплаты в этом месяце</dt>
          <dd><strong>{formatMoney(summary.couponMonth)}</strong></dd>
        </div>
        <div className={styles.couponMetric}>
          <dt>Получено купонами за всё время</dt>
          <dd className={styles.positive}><strong>{signedMoney(summary.couponReceivedTotal)}</strong></dd>
        </div>
      </dl>
      <div
        className={styles.couponProgress}
        role="progressbar"
        aria-label={`Купоны за ${summary.couponYear} год`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={summary.couponProgress}
        aria-valuetext={`${formatMoney(summary.couponReceived)} из ${formatMoney(summary.couponExpected)}`}
      >
        <span
          className={styles.couponProgressFill}
          data-progress-fill
          aria-hidden="true"
          style={{ width: `${summary.couponProgress}%` }}
        />
        <strong className={styles.couponProgressCopy}>
          {formatMoney(summary.couponReceived)} / {formatMoney(summary.couponExpected)}
        </strong>
      </div>
    </div>
  );
}
