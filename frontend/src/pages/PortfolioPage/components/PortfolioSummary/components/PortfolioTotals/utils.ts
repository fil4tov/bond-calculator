import styles from '../../PortfolioSummary.module.scss';

export function resultClassName(value: string | null) {
  if (value === null || /^0(?:\.0+)?$/.test(value)) return styles.neutral;
  return value.startsWith('-') ? styles.negative : styles.positive;
}
