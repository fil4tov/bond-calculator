import { Tooltip } from '#shared/ui';

import { formatMoney, formatPercent } from '../../../../utils';
import styles from '../../PortfolioSummary.module.scss';
import type { PortfolioSummaryData } from '../../types';
import { signedMoney } from '../../utils';
import { resultClassName } from './utils';

export function PortfolioTotals({ summary }: { summary: PortfolioSummaryData }) {
  const marketUnavailable = summary.marketValue === null;

  return (
    <dl className={styles.bondCard} aria-label="Общая информация по облигациям">
      <div className={`${styles.metric} ${styles.marketMetric}`}>
        <dt>Рыночная стоимость с НКД</dt>
        <dd>
          <strong>{summary.marketValue === null ? '—' : formatMoney(summary.marketValue)}</strong>
          {!marketUnavailable ? <span>на сегодня</span> : null}
        </dd>
        {marketUnavailable ? (
          <div className={styles.marketHelp}>
            <Tooltip label="Почему рыночная стоимость недоступна">
              Не удалось получить рыночную цену хотя бы для одного открытого выпуска.
            </Tooltip>
          </div>
        ) : null}
      </div>

      <div className={styles.metric}>
        <dt>Вложено</dt>
        <dd><strong>{formatMoney(summary.investedAmount)}</strong></dd>
      </div>

      <div className={styles.metric}>
        <dt className={styles.labelWithHelp}>
          За всё время
          <Tooltip label="Что означает результат за всё время" align="right">
            Разница текущей рыночной стоимости с НКД относительно вложенной суммы
          </Tooltip>
        </dt>
        <dd className={resultClassName(summary.currentResult)}>
          <strong>{summary.currentResult === null ? '—' : signedMoney(summary.currentResult)}</strong>
        </dd>
      </div>

      <div className={styles.metric}>
        <dt className={styles.labelWithHelp}>
          Доходность за {summary.couponYear} год
          <Tooltip
            label={`Как рассчитывается доходность портфеля за ${summary.couponYear} год`}
            align="right"
          >
            Все известные купоны открытых выпусков за {summary.couponYear} год ÷ текущая вложенная сумма
          </Tooltip>
        </dt>
        <dd>
          <strong>
            {summary.calendarYearYieldPercent === null
              ? '—'
              : formatPercent(summary.calendarYearYieldPercent)}
          </strong>
        </dd>
      </div>
    </dl>
  );
}
