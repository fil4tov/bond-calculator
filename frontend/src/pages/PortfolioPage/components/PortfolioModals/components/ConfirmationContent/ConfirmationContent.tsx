import type { ReactNode } from 'react';

import { Button } from '#shared/ui';

import styles from '../../../../PortfolioPage.module.scss';

interface ConfirmationContentProps {
  children: ReactNode;
  error: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmationContent({
  children,
  error,
  busy,
  onCancel,
  onConfirm,
}: ConfirmationContentProps) {
  return (
    <div className={styles.confirmation}>
      <p>{children}</p>
      {error ? <p className={styles.confirmationError} role="alert">{error}</p> : null}
      <div className={styles.confirmationActions}>
        <Button type="button" disabled={busy} onClick={onCancel}>Отмена</Button>
        <Button type="button" variant="danger" disabled={busy} onClick={onConfirm}>
          {busy ? 'Удаляем…' : 'Удалить'}
        </Button>
      </div>
    </div>
  );
}
