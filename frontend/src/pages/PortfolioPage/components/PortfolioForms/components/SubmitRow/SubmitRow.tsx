import type { ReactNode } from 'react';

import { Button } from '#shared/ui';

import styles from '../../PortfolioForms.module.scss';

interface SubmitRowProps {
  children?: ReactNode;
  disabled: boolean;
  busy: boolean;
  busyLabel: string;
  idleLabel: string;
}

export function SubmitRow({ children, disabled, busy, busyLabel, idleLabel }: SubmitRowProps) {
  return (
    <div className={styles.submitRow}>
      {children}
      <Button className={styles.submitButton} type="submit" disabled={disabled}>
        {busy ? busyLabel : idleLabel}
      </Button>
    </div>
  );
}
