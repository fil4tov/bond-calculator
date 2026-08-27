import { FiArrowDownLeft, FiArrowUpRight } from 'react-icons/fi';

import styles from '../../BondDetails.module.scss';

interface OperationActionsProps {
  saleDisabled: boolean;
  onAddPurchase: (returnFocusTarget: HTMLElement) => void;
  onAddSale: (returnFocusTarget: HTMLElement) => void;
}

export function OperationActions({
  saleDisabled,
  onAddPurchase,
  onAddSale,
}: OperationActionsProps) {
  return (
    <div className={styles.operationActionGrid} role="group" aria-label="Добавить операцию">
      <button
        type="button"
        className={`${styles.operationAction} ${styles.purchaseAction}`}
        aria-label="Зафиксировать покупку"
        onClick={(event) => onAddPurchase(event.currentTarget)}
      >
        <span className={styles.operationActionIcon}><FiArrowDownLeft aria-hidden="true" /></span>
        <span>
          <strong>Зафиксировать покупку</strong>
          <small>Увеличить позицию</small>
        </span>
      </button>
      <button
        type="button"
        className={`${styles.operationAction} ${styles.saleAction}`}
        aria-label="Зафиксировать продажу"
        disabled={saleDisabled}
        onClick={(event) => onAddSale(event.currentTarget)}
      >
        <span className={styles.operationActionIcon}><FiArrowUpRight aria-hidden="true" /></span>
        <span>
          <strong>Зафиксировать продажу</strong>
          <small>{saleDisabled ? 'Нет бумаг для продажи' : 'Уменьшить позицию'}</small>
        </span>
      </button>
    </div>
  );
}
