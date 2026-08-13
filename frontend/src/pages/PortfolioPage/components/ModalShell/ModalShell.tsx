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
  mobileFillHeight?: boolean;
  mobileContentFillsHeight?: boolean;
}

export function ModalShell({
  title,
  subtitle,
  eyebrow = 'ПОРТФЕЛЬ',
  children,
  busy,
  onClose,
  returnFocusTarget,
  mobileFillHeight = false,
  mobileContentFillsHeight = false,
}: ModalShellProps) {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      eyebrow={eyebrow}
      busy={busy}
      onClose={onClose}
      returnFocusTarget={returnFocusTarget}
      width="wide"
      mobileFillHeight={mobileFillHeight}
      mobileContentFillsHeight={mobileContentFillsHeight}
    >
      {children}
    </Modal>
  );
}
