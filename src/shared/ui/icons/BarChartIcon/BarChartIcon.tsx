import type { HTMLAttributes } from 'react';

import styles from './BarChartIcon.module.scss';

export type BarChartIconProps = HTMLAttributes<HTMLSpanElement>;

export function BarChartIcon({ className = '', ...props }: BarChartIconProps) {
  return (
    <span className={`${styles.icon} ${className}`} aria-hidden="true" {...props}>
      <span className={styles.shortBar} />
      <span className={styles.mediumBar} />
      <span className={styles.tallBar} />
    </span>
  );
}
