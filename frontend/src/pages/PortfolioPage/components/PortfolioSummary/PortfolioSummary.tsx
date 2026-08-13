import type { BondPortfolioItem } from '#entities/bondPortfolio';

import styles from './PortfolioSummary.module.scss';
import { CouponTotals, PortfolioTotals } from './components';
import { calculatePortfolioSummary } from './utils';

export function PortfolioSummary({ bonds }: { bonds: BondPortfolioItem[] }) {
  const summary = calculatePortfolioSummary(bonds);

  return (
    <section className={styles.summary} aria-label="Сводка портфеля">
      <PortfolioTotals summary={summary} />
      <CouponTotals summary={summary} />
    </section>
  );
}
