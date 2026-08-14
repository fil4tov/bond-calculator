import styles from '../../PortfolioPage.module.scss';

export function PortfolioLoadingState() {
  return (
    <div className={styles.skeletonList} aria-label="Загрузка портфеля" aria-live="polite">
      {[0, 1].map((item) => (
        <div key={item} className={styles.skeletonCard}>
          <span /><span /><span /><span />
        </div>
      ))}
    </div>
  );
}
