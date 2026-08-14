import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { Tooltip } from '#shared/ui';

import {
  annualCouponYieldDescription,
  calendarYearCouponIncomeDescription,
  couponYieldDescription,
  formatMoney,
  formatPercent,
} from '../../../../utils';
import styles from '../../BondDetails.module.scss';

export function CouponMetrics({ bond }: { bond: BondPortfolioItem }) {
  return (
    <dl className={styles.metricsGrid}>
      <div>
        <dt className={styles.metricLabel}>
          <span>Годовая купонная доходность</span>
          <Tooltip label="Как рассчитывается годовая купонная доходность" align="right">
            {annualCouponYieldDescription()}
          </Tooltip>
        </dt>
        <dd>{bond.annualCouponYieldPercent === null ? '—' : formatPercent(bond.annualCouponYieldPercent)}</dd>
      </div>
      <div>
        <dt className={styles.metricLabel}>
          <span>Доходность отдельных купонов за {bond.couponYieldYear} год</span>
          <Tooltip label={`Как рассчитывается доходность отдельных купонов за ${bond.couponYieldYear} год`} align="right">
            {couponYieldDescription(bond.couponYieldYear)}
          </Tooltip>
        </dt>
        <dd>{formatPercent(bond.calendarYearCouponYieldPercent)}</dd>
      </div>
      <div><dt>Выплачено купонов</dt><dd>{formatMoney(bond.paidCouponTotal)}</dd></div>
      <div>
        <dt className={styles.metricLabel}>
          <span>Ожидаемый купонный доход за {bond.couponYieldYear} год</span>
          <Tooltip label={`Как рассчитывается ожидаемый купонный доход за ${bond.couponYieldYear} год`} align="right">
            {calendarYearCouponIncomeDescription(bond.couponYieldYear)}
          </Tooltip>
        </dt>
        <dd className={styles.positive}>+{formatMoney(bond.calendarYearCouponIncome)}</dd>
      </div>
    </dl>
  );
}
