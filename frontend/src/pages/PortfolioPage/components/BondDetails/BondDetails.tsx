import type { BondPortfolioItem } from '#entities/bondPortfolio';

import styles from './BondDetails.module.scss';
import {
  CouponMetrics,
  IssueInformation,
  NextCoupon,
  OperationHistory,
  PositionMetrics,
} from './components';

interface BondDetailsProps {
  bond: BondPortfolioItem;
  onDeleteOperation?: (operationId: string, returnFocusTarget: HTMLElement) => void;
  operationDeleteDisabled?: boolean;
  focusOperationId?: string | null;
}

export function BondDetails({
  bond,
  onDeleteOperation,
  operationDeleteDisabled = false,
  focusOperationId = null,
}: BondDetailsProps) {
  return (
    <div className={styles.details}>
      <IssueInformation bond={bond} />
      <PositionMetrics bond={bond} />
      <CouponMetrics bond={bond} />
      <NextCoupon bond={bond} />
      <OperationHistory
        bond={bond}
        onDeleteOperation={onDeleteOperation}
        operationDeleteDisabled={operationDeleteDisabled}
        focusOperationId={focusOperationId}
      />
    </div>
  );
}
