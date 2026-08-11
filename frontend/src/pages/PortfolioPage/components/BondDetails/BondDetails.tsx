import { useEffect, useRef } from 'react';
import { FiTrash2 } from 'react-icons/fi';

import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { Tooltip } from '#shared/ui';

import { couponYieldDescription, formatDate, formatDayCount, formatMoney, formatPercent, formatYearCount } from '../../utils';
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
            <span>Остаток позиции</span>
            <Tooltip label="Как рассчитывается остаток позиции">
              Полная остаточная себестоимость облигаций в открытой позиции после всех покупок и продаж. Для закрытой позиции равна нулю.
            </Tooltip>
          </dt>
          <dd>{formatMoney(bond.positionCostBasis)}</dd>
        </div>
        <div><dt>Количество</dt><dd>{bond.totalQuantity.toLocaleString('ru-RU')} шт.</dd></div>
        <div>
          <dt className={styles.metricLabel}>
            <span>Купонная доходность за {bond.couponYieldYear} год</span>
            <Tooltip label={`Как рассчитывается купонная доходность за ${bond.couponYieldYear} год`}>
              {couponYieldDescription(bond.couponYieldYear)}
            </Tooltip>
          </dt>
          <dd>{formatPercent(bond.calendarYearCouponYieldPercent)}</dd>
        </div>
        <div><dt>Выплачено купонов</dt><dd>{formatMoney(bond.paidCouponTotal)}</dd></div>
        <div>
          <dt className={styles.metricLabel}>
            <span>Результат сделок</span>
            <Tooltip label="Как рассчитывается результат сделок">
              Сумма результатов всех продаж: полученная сумма сделки минус списанная средняя стоимость проданных облигаций.
            </Tooltip>
          </dt>
          <dd className={styles[resultSign(bond.realizedResult)]} data-result-sign={resultSign(bond.realizedResult)}>{formatMoney(bond.realizedResult)}</dd>
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
                <span>{operation.operationType === 'purchase' ? '+' : '−'}{operation.quantity.toLocaleString('ru-RU')} шт.</span>
              </div>
              <div className={styles.operationMeta}>
                <time dateTime={operation.operationDate}>{formatDate(operation.operationDate)}</time>
                {operation.realizedResult !== null ? (
                  <b
                    className={`${styles.realizedResult} ${styles[resultSign(operation.realizedResult)]}`}
                    data-result-sign={resultSign(operation.realizedResult)}
                  >
                    {formatMoney(operation.realizedResult)}
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
