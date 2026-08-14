import { useEffect, useRef } from 'react';
import { FiTrash2 } from 'react-icons/fi';

import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { formatDate, formatMoney } from '../../../../utils';
import styles from '../../BondDetails.module.scss';
import { formatOperationResult, resultSign } from '../../utils';
import { formatOperationCount } from './utils';

interface OperationHistoryProps {
  bond: BondPortfolioItem;
  onDeleteOperation?: (operationId: string, returnFocusTarget: HTMLElement) => void;
  operationDeleteDisabled?: boolean;
  focusOperationId?: string | null;
}

export function OperationHistory({
  bond,
  onDeleteOperation,
  operationDeleteDisabled = false,
  focusOperationId = null,
}: OperationHistoryProps) {
  const focusDeleteRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!focusOperationId) return undefined;
    const timeout = window.setTimeout(() => focusDeleteRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [focusOperationId]);

  return (
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
  );
}
