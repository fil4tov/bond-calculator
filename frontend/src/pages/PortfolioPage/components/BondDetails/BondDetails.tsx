import { useState } from 'react';
import type { ReactNode } from 'react';

import type { BondPortfolioItem } from '#entities/bondPortfolio';

import styles from './BondDetails.module.scss';
import { BOND_DETAILS_SECTIONS } from './constants';
import {
  BondDetailsChrome,
  CouponMetrics,
  CouponPaymentHistory,
  CouponSchedule,
  IssueInformation,
  NextCoupon,
  OperationActions,
  OperationHistory,
  PositionMetrics,
} from './components';
import type { BondDetailsSection } from './types';

interface BondDetailsProps {
  bond: BondPortfolioItem;
  onAddPurchase: (returnFocusTarget: HTMLElement) => void;
  onAddSale: (returnFocusTarget: HTMLElement) => void;
  onDeleteBond: (returnFocusTarget: HTMLElement) => void;
  onDeleteOperation?: (operationId: string, returnFocusTarget: HTMLElement) => void;
  operationDeleteDisabled?: boolean;
  onRefreshCouponSchedule: () => Promise<void>;
  focusOperationId?: string | null;
  titleId: string;
  closeButton: ReactNode;
}

export function BondDetails({
  bond,
  onAddPurchase,
  onAddSale,
  onDeleteBond,
  onDeleteOperation,
  operationDeleteDisabled = false,
  onRefreshCouponSchedule,
  focusOperationId = null,
  titleId,
  closeButton,
}: BondDetailsProps) {
  const [activeSection, setActiveSection] = useState<BondDetailsSection>(
    focusOperationId ? 'operations' : 'position',
  );
  const activeSectionLabel = BOND_DETAILS_SECTIONS.find(
    (section) => section.id === activeSection,
  )?.label;

  return (
    <div className={styles.layout}>
      <h2 id={titleId} className={styles.accessibleTitle}>{bond.name}</h2>
      <BondDetailsChrome
        bond={bond}
        activeSection={activeSection}
        closeButton={closeButton}
        onSectionChange={setActiveSection}
        onDeleteBond={onDeleteBond}
      />
      <div className={styles.content}>
        <div className={styles.contentHeader}>
          <strong>{activeSectionLabel}</strong>
          <span>Подробная информация</span>
        </div>
        <div className={styles.contentViewport} data-bond-details-scroll-viewport>
          <section
            className={styles.section}
            role="tabpanel"
            aria-label="Об облигации"
            hidden={activeSection !== 'issue'}
          >
            <IssueInformation bond={bond} showStatus={false} />
          </section>
          <section
            className={styles.section}
            role="tabpanel"
            aria-label="Моя позиция"
            hidden={activeSection !== 'position'}
          >
            <PositionMetrics bond={bond} />
          </section>
          <section
            className={styles.section}
            role="tabpanel"
            aria-label="Купоны"
            hidden={activeSection !== 'coupons'}
          >
            <NextCoupon bond={bond} />
            <CouponMetrics bond={bond} />
            <CouponPaymentHistory bond={bond} />
            <CouponSchedule bond={bond} onRefresh={onRefreshCouponSchedule} />
          </section>
          <section
            className={styles.section}
            role="tabpanel"
            aria-label="Операции"
            hidden={activeSection !== 'operations'}
          >
            <OperationActions
              saleDisabled={bond.totalQuantity <= 0}
              onAddPurchase={onAddPurchase}
              onAddSale={onAddSale}
            />
            <OperationHistory
              bond={bond}
              onDeleteOperation={onDeleteOperation}
              operationDeleteDisabled={operationDeleteDisabled}
              focusOperationId={focusOperationId}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
