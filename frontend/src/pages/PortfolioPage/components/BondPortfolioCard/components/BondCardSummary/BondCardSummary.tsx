import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { Tooltip } from '#shared/ui';

import {
  calendarYearCouponIncomeDescription,
  currentMarketValue,
  formatMoney,
} from '../../../../utils';
import styles from '../../BondPortfolioCard.module.scss';
import { maturityLabel } from './utils';

interface BondCardSummaryProps {
  bond: BondPortfolioItem;
  summaryId: string;
}

export function BondCardSummary({ bond, summaryId }: BondCardSummaryProps) {
  const marketValue = currentMarketValue(bond);

  return (
    <span id={summaryId} className={styles.summary}>
      <span className={styles.identity}>
        <strong className={styles.name}>{bond.name}</strong>
        <span className={styles.meta}>
          <span>{bond.totalQuantity.toLocaleString('ru-RU')} шт.</span>
          <span>{maturityLabel(bond)}</span>
        </span>
      </span>
      <span className={styles.value}>
        <strong>
          {marketValue === null ? '—' : formatMoney(marketValue)}
          <span className={styles.marketValueHelp}>
            <Tooltip label="Текущая рыночная стоимость + НКД" align="right">
              Текущая рыночная стоимость + НКД
            </Tooltip>
          </span>
        </strong>
        <span className={styles.yieldLine}>
          +{formatMoney(bond.calendarYearCouponIncome)}
          <span className={styles.yieldHelp}>
            <Tooltip
              label={`Как рассчитывается сумма купонов за ${bond.couponYieldYear} год`}
              align="right"
            >
              {calendarYearCouponIncomeDescription(bond.couponYieldYear)}
            </Tooltip>
          </span>
        </span>
      </span>
    </span>
  );
}
