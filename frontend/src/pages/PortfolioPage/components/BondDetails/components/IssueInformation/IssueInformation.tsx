import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { formatDate, formatMoney } from '../../../../utils';
import styles from '../../BondDetails.module.scss';
import { maturityValue } from './utils';

export function IssueInformation({ bond }: { bond: BondPortfolioItem }) {
  const statusLabel = bond.status === 'matured'
    ? 'Погашена'
    : bond.status === 'payment_pending' ? 'Ожидается выплата' : 'Активна';

  return (
    <>
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
    </>
  );
}
