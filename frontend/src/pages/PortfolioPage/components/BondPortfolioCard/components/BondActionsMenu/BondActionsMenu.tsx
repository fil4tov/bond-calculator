import { useRef, useState } from 'react';

import { Dropdown } from '#shared/ui';

import styles from '../../BondPortfolioCard.module.scss';
import type { BondActionHandler } from '../../types';

interface BondActionsMenuProps {
  bondName: string;
  totalQuantity: number;
  deleteDisabled: boolean;
  onAddPurchase: BondActionHandler;
  onAddSale: BondActionHandler;
  onDelete: BondActionHandler;
}

export function BondActionsMenu({
  bondName,
  totalQuantity,
  deleteDisabled,
  onAddPurchase,
  onAddSale,
  onDelete,
}: BondActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const runAction = (action: BondActionHandler) => {
    setOpen(false);
    if (triggerRef.current) action(triggerRef.current);
  };

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      mobileMode="anchored"
      className={styles.actions}
      contentClassName={styles.actionsMenu}
      trigger={(triggerProps) => (
        <button
          ref={(element) => {
            triggerProps.ref.current = element;
            triggerRef.current = element;
          }}
          type="button"
          className={styles.actionsTrigger}
          aria-label={`Действия с облигацией ${bondName}`}
          aria-expanded={triggerProps['aria-expanded']}
          aria-controls={triggerProps['aria-controls']}
          onClick={triggerProps.onClick}
        >
          <span aria-hidden="true">•••</span>
        </button>
      )}
    >
      <div>
        <button type="button" className={styles.menuItem} onClick={() => runAction(onAddPurchase)}>
          Зафиксировать покупку
        </button>
        <button
          type="button"
          className={styles.menuItem}
          disabled={totalQuantity <= 0}
          onClick={() => runAction(onAddSale)}
        >
          Зафиксировать продажу
        </button>
        <button
          type="button"
          className={`${styles.menuItem} ${styles.deleteMenuItem}`}
          disabled={deleteDisabled}
          onClick={() => runAction(onDelete)}
        >
          Удалить из портфеля
        </button>
      </div>
    </Dropdown>
  );
}
