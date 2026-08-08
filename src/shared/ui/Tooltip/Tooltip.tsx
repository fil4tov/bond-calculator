import { useId } from 'react';
import type { ReactNode } from 'react';

import styles from './Tooltip.module.scss';

interface TooltipProps { label: string; children: ReactNode; align?: 'left' | 'right' }

export function Tooltip({ label, children, align = 'left' }: TooltipProps) {
  const id = useId();
  return (
    <span className={`${styles.tooltip} ${styles[align]}`}>
      <button type="button" className={styles.trigger} aria-label={label} aria-describedby={id}>?</button>
      <span id={id} className={styles.content} role="tooltip">{children}</span>
    </span>
  );
}
