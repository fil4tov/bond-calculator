import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { Tooltip } from '#shared/ui';

import {
  currentMarketValue,
  formatMoney,
  marketValueAndAciDescription,
} from '../../../../utils';
import styles from '../../BondDetails.module.scss';
import { formatOperationResult, resultSign } from '../../utils';

export function PositionMetrics({ bond }: { bond: BondPortfolioItem }) {
  const hasSale = bond.operations.some((operation) => operation.operationType === 'sale');
  const currentAci = bond.positionStatus === 'open' ? bond.accruedCouponIncome : null;
  const totalMarketValue = currentMarketValue(bond);

  return (
    <dl className={styles.metricsGrid}>
      <div>
        <dt className={styles.metricLabel}>
          <span>Текущая рыночная стоимость</span>
          <Tooltip label="Что входит в полную стоимость облигаций">
            {marketValueAndAciDescription()}
          </Tooltip>
        </dt>
        <dd className={styles.marketValue}>
          <span>{totalMarketValue === null ? '—' : formatMoney(totalMarketValue)}</span>
          {bond.marketValueWithoutAci !== null && currentAci !== null ? (
            <span className={styles.marketValueBreakdown}>
              {formatMoney(bond.marketValueWithoutAci)} + {formatMoney(currentAci)} НКД
            </span>
          ) : null}
        </dd>
      </div>
      <div>
        <dt className={styles.metricLabel}>
          <span>{hasSale ? 'Вложено в оставшиеся облигации' : 'Вложено в облигации'}</span>
          <Tooltip label="Как рассчитывается сумма, вложенная в оставшиеся облигации" align="right">
            Сколько из потраченных на покупки денег приходится на облигации, которые ещё остаются в портфеле. После продажи сумма уменьшается на среднюю стоимость проданных облигаций. Это не текущая рыночная цена.
          </Tooltip>
        </dt>
        <dd>{formatMoney(bond.positionCostBasis)}</dd>
      </div>
      <div><dt>Количество</dt><dd>{bond.totalQuantity.toLocaleString('ru-RU')} шт.</dd></div>
      <div>
        <dt className={styles.metricLabel}>
          <span>Результат сделок</span>
          <Tooltip label="Как рассчитывается результат сделок" align="right">
            Сумма результатов всех продаж: полученная сумма сделки минус списанная средняя стоимость проданных облигаций.
          </Tooltip>
        </dt>
        <dd
          className={styles[resultSign(bond.realizedResult)]}
          data-result-sign={resultSign(bond.realizedResult)}
        >
          {formatOperationResult(bond.realizedResult)}
        </dd>
      </div>
    </dl>
  );
}
