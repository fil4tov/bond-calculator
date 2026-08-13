import { useId } from 'react';

import styles from './BondPortfolioCard.module.scss';
import { BondActionsMenu, BondCardSummary, CouponProgress } from './components';
import type { BondPortfolioCardProps } from './types';

export function BondPortfolioCard({
  bond,
  onOpenDetails,
  onAddPurchase,
  onAddSale,
  onDelete,
  deleteDisabled = false,
}: BondPortfolioCardProps) {
  const summaryId = useId();
  const matured = bond.status === 'matured';

  return (
    <article className={`${styles.card} ${matured ? styles.matured : ''}`} aria-label={bond.name}>
      <div
        className={styles.main}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty('--hover-x', `${event.clientX - bounds.left}px`);
          event.currentTarget.style.setProperty('--hover-y', `${event.clientY - bounds.top}px`);
        }}
      >
        <div className={styles.mainContent}>
          <BondCardSummary bond={bond} summaryId={summaryId} />
          <CouponProgress bond={bond} />
        </div>
        <button
          type="button"
          className={styles.detailsTrigger}
          aria-label={`Открыть сведения об облигации ${bond.name}`}
          aria-describedby={summaryId}
          onClick={(event) => onOpenDetails(event.currentTarget)}
        />
      </div>

      <BondActionsMenu
        bondName={bond.name}
        totalQuantity={bond.totalQuantity}
        deleteDisabled={deleteDisabled}
        onAddPurchase={onAddPurchase}
        onAddSale={onAddSale}
        onDelete={onDelete}
      />
    </article>
  );
}
