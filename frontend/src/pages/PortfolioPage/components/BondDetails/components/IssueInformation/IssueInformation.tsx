import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { formatDate, formatMoney } from '../../../../utils';
import styles from '../../BondDetails.module.scss';
import { BondStatus } from '../BondStatus';
import { maturityValue } from './utils';

export function IssueInformation({
  bond,
  showStatus = true,
}: {
  bond: BondPortfolioItem;
  showStatus?: boolean;
}) {
  return (
    <>
      {showStatus ? <BondStatus bond={bond} /> : null}
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
