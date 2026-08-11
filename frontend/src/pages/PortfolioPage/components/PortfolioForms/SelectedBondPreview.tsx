import type { TInvestBondLookup } from '#entities/bondPortfolio';

import { formatDate, formatMoney } from '../../utils';
import styles from './PortfolioForms.module.scss';

interface SelectedBondPreviewProps {
  bond: TInvestBondLookup;
  status: 'checking' | 'available' | 'duplicate' | 'error';
  statusMessage?: string;
  onRetry?: () => void;
}

export function SelectedBondPreview({ bond, status, statusMessage, onRetry }: SelectedBondPreviewProps) {
  const showStatus = status === 'duplicate' || status === 'error';

  return (
    <section className={styles.bondPreview} aria-label="Выбранная облигация">
      <header className={styles.previewHeader}>
        <div className={styles.previewIdentity}>
          <strong>{bond.name}</strong>
        </div>
        <span className={styles.previewTicker}>{bond.ticker}</span>
      </header>
      <dl className={styles.previewFacts}>
        <div><dt>Номинал</dt><dd>{formatMoney(bond.nominal)}</dd></div>
        <div><dt>Выплат в год</dt><dd>{bond.paymentsPerYear.toLocaleString('ru-RU')}</dd></div>
        <div><dt>Дата размещения</dt><dd>{formatDate(bond.placementDate)}</dd></div>
        <div><dt>Дата погашения</dt><dd>{formatDate(bond.maturityDate)}</dd></div>
      </dl>
      {showStatus ? (
        <div className={`${styles.previewStatus} ${styles.previewStatusError}`} aria-live="polite">
          {status === 'duplicate' ? <span>{statusMessage ?? 'Облигация с таким названием уже есть'}</span> : null}
          {status === 'error' ? (
            <span>
              Не удалось проверить облигацию.
              {onRetry ? <button type="button" onClick={onRetry}>Повторить проверку</button> : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
