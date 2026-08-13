import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { Tooltip } from '#shared/ui';

import { calculatePortfolioSummary } from '../../portfolioSummary';
import { formatMoney } from '../../utils';
import styles from './PortfolioSummary.module.scss';

interface PortfolioSummaryProps {
  bonds: BondPortfolioItem[];
}

const MONTHS_PREPOSITIONAL = [
  'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
  'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре',
] as const;

function signedMoney(value: string) {
  if (value.startsWith('-') || /^0(?:\.0+)?$/.test(value)) return formatMoney(value);
  return `+${formatMoney(value)}`;
}

function resultClassName(value: string | null) {
  if (value === null || /^0(?:\.0+)?$/.test(value)) return styles.neutral;
  return value.startsWith('-') ? styles.negative : styles.positive;
}

export function PortfolioSummary({ bonds }: PortfolioSummaryProps) {
  const summary = calculatePortfolioSummary(bonds);
  const currentMonth = MONTHS_PREPOSITIONAL[new Date().getUTCMonth()];
  const marketUnavailable = summary.marketValue === null;

  return (
    <section className={styles.summary} aria-label="Сводка портфеля">
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
          <dt>Открытых выпусков</dt>
          <dd><strong>{summary.openIssueCount}</strong></dd>
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
      </dl>

      <div className={styles.couponCard}>
        <dl className={styles.couponMetrics} aria-label="Информация по купонам">
          <div className={styles.couponMetric}>
            <dt>Получено купонами за {summary.couponYear} год</dt>
            <dd className={styles.positive}><strong>{formatMoney(summary.couponReceived)}</strong></dd>
          </div>
          <div className={styles.couponMetric}>
            <dt>Всего ожидается за {summary.couponYear} год</dt>
            <dd><strong>{formatMoney(summary.couponExpected)}</strong></dd>
          </div>
          <div className={styles.couponMetric}>
            <dt>Выплаты в {currentMonth}</dt>
            <dd><strong>{formatMoney(summary.couponMonth)}</strong></dd>
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
    </section>
  );
}
