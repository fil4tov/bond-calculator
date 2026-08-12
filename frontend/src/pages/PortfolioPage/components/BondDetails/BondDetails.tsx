import { useEffect, useRef } from 'react';
import { FiTrash2 } from 'react-icons/fi';

import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { Tooltip } from '#shared/ui';

import { annualCouponYieldDescription, calendarYearCouponIncomeDescription, couponYieldDescription, formatDate, formatDayCount, formatMoney, formatPercent, formatYearCount, marketValueAndAciDescription } from '../../utils';
import styles from './BondDetails.module.scss';

function maturityValue(bond: BondPortfolioItem) {
  if (bond.status === 'matured') return 'Погашена';
  if (bond.status === 'payment_pending') return 'Ожидается выплата';
  const { years, months, daysUntil } = bond.maturityRemaining;
  return `${formatYearCount(years)} ${months} мес. · ${daysUntil.toLocaleString('ru-RU')} дн.`;
}

function formatOperationCount(count: number) {
  const category = new Intl.PluralRules('ru-RU').select(count);
  const label = category === 'one' ? 'операция' : category === 'few' ? 'операции' : 'операций';
  return `${count.toLocaleString('ru-RU')} ${label}`;
}

function resultSign(value: string) {
  if (/^-?0+(?:\.0+)?$/.test(value)) return 'zero' as const;
  return value.startsWith('-') ? 'negative' as const : 'positive' as const;
}

function formatOperationResult(value: string) {
  return `${resultSign(value) === 'positive' ? '+' : ''}${formatMoney(value)}`;
}

function addMoneyValues(left: string, right: string) {
  const toKopecks = (value: string) => {
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match) throw new Error('Expected a plain money value');
    const amount = BigInt(match[2]!) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'));
    return match[1] ? -amount : amount;
  };
  const total = toKopecks(left) + toKopecks(right);
  const absolute = total < 0n ? -total : total;
  return `${total < 0n ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

export function BondDetails({ bond, onDeleteOperation, operationDeleteDisabled = false, focusOperationId = null }: {
  bond: BondPortfolioItem;
  onDeleteOperation?: (operationId: string, returnFocusTarget: HTMLElement) => void;
  operationDeleteDisabled?: boolean;
  focusOperationId?: string | null;
}) {
  const focusDeleteRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!focusOperationId) return undefined;
    const timeout = window.setTimeout(() => focusDeleteRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [focusOperationId]);
  const statusLabel = bond.status === 'matured'
    ? 'Погашена'
    : bond.status === 'payment_pending' ? 'Ожидается выплата' : 'Активна';
  const emptyCouponLabel = bond.status === 'matured'
    ? 'Облигация погашена'
    : bond.status === 'payment_pending'
      ? 'Ожидается выплата'
      : 'Купонные выплаты не предусмотрены';
  const hasSale = bond.operations.some((operation) => operation.operationType === 'sale');
  const currentAci = bond.positionStatus === 'open' ? bond.accruedCouponIncome : null;
  const totalMarketValue = bond.marketValueWithoutAci !== null && currentAci !== null
    ? addMoneyValues(bond.marketValueWithoutAci, currentAci)
    : bond.marketValueWithoutAci;
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
        <div><dt>Срок до погашения</dt><dd>{maturityValue(bond)}</dd></div>
      </dl>

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
            <span>Ожидаемый купонный доход за {bond.couponYieldYear} год</span>
            <Tooltip label={`Как рассчитывается ожидаемый купонный доход за ${bond.couponYieldYear} год`} align="right">
              {calendarYearCouponIncomeDescription(bond.couponYieldYear)}
            </Tooltip>
          </dt>
          <dd className={styles.positive}>+{formatMoney(bond.calendarYearCouponIncome)}</dd>
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
        <div>
          <dt className={styles.metricLabel}>
            <span>Годовая купонная доходность</span>
            <Tooltip label="Как рассчитывается годовая купонная доходность" align="right">
              {annualCouponYieldDescription()}
            </Tooltip>
          </dt>
          <dd>{bond.annualCouponYieldPercent === null ? '—' : formatPercent(bond.annualCouponYieldPercent)}</dd>
        </div>
        <div><dt>Выплачено купонов</dt><dd>{formatMoney(bond.paidCouponTotal)}</dd></div>
        <div>
          <dt className={styles.metricLabel}>
            <span>Результат сделок</span>
            <Tooltip label="Как рассчитывается результат сделок" align="right">
              Сумма результатов всех продаж: полученная сумма сделки минус списанная средняя стоимость проданных облигаций.
            </Tooltip>
          </dt>
          <dd className={styles[resultSign(bond.realizedResult)]} data-result-sign={resultSign(bond.realizedResult)}>{formatOperationResult(bond.realizedResult)}</dd>
        </div>
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

      <section className={styles.purchaseHistory} aria-label="История операций">
        <div className={styles.purchaseHistoryHeading}>
          <h3>История операций</h3>
          <span>{formatOperationCount(bond.operations.length)}</span>
        </div>
        <ol className={styles.purchaseTimeline}>
          {bond.operations.map((operation) => (
            <li key={operation.id} className={styles.purchaseItem}>
              <span className={styles.timelineMarker} aria-hidden="true" />
              <div className={styles.purchaseData}>
                <strong>{formatMoney(operation.amount)}</strong>
                <span className={operation.operationType === 'sale' ? styles.saleQuantity : undefined}>
                  {operation.operationType === 'purchase' ? '+' : '−'}{operation.quantity.toLocaleString('ru-RU')} шт.
                </span>
              </div>
              <div className={styles.operationMeta}>
                <time dateTime={operation.operationDate}>{formatDate(operation.operationDate)}</time>
                {operation.realizedResult !== null ? (
                  <b
                    className={`${styles.realizedResult} ${styles[resultSign(operation.realizedResult)]}`}
                    data-result-sign={resultSign(operation.realizedResult)}
                  >
                    {formatOperationResult(operation.realizedResult)}
                  </b>
                ) : null}
              </div>
              {onDeleteOperation ? (
                <button
                  ref={operation.id === focusOperationId ? focusDeleteRef : undefined}
                  type="button"
                  className={styles.deleteOperation}
                  aria-label={`Удалить операцию ${operation.operationType === 'purchase' ? 'покупки' : 'продажи'}`}
                  disabled={operationDeleteDisabled}
                  onClick={(event) => onDeleteOperation(operation.id, event.currentTarget)}
                >
                  <FiTrash2 aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
