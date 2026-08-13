import { useState } from 'react';

import { ModalShell } from '../ModalShell';
import { AddSaleForm } from '../PortfolioForms';
import type { PortfolioModalProps } from './types';

interface AddSaleModalProps extends PortfolioModalProps {
  userId: string;
}

export function AddSaleModal({ modal, userId, onClose }: AddSaleModalProps) {
  const [busy, setBusy] = useState(false);

  if (modal?.kind !== 'sale') return null;

  return (
    <ModalShell
      title="Зафиксировать продажу"
      subtitle={modal.bond.name}
      eyebrow={null}
      busy={busy}
      mobileFillHeight
      mobileContentFillsHeight
      returnFocusTarget={modal.returnFocusTarget}
      onClose={onClose}
    >
      <AddSaleForm
        userId={userId}
        bond={modal.bond}
        onBusyChange={setBusy}
        onSuccess={onClose}
      />
    </ModalShell>
  );
}
