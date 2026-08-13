import type { ReactNode } from 'react';

import { Modal } from '#shared/ui';

interface ModalShellProps {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string | null;
  children: ReactNode;
  busy: boolean;
  onClose: () => void;
  returnFocusTarget?: HTMLElement | null;
}

export function ModalShell({ title, subtitle, eyebrow = 'ПОРТФЕЛЬ', children, busy, onClose, returnFocusTarget }: ModalShellProps) {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      eyebrow={eyebrow}
      busy={busy}
      onClose={onClose}
      returnFocusTarget={returnFocusTarget}
      width="wide"
    >
      {children}
    </Modal>
  );
}
