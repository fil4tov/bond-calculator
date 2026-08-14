import { useState } from 'react';

import { ModalShell } from '../ModalShell';
import { AddPurchaseForm } from '../PortfolioForms';
import type { PortfolioModalProps } from './types';

interface AddPurchaseModalProps extends PortfolioModalProps {
  userId: string;
}

export function AddPurchaseModal({ modal, userId, onClose }: AddPurchaseModalProps) {
  const [busy, setBusy] = useState(false);

  if (modal?.kind !== 'purchase') return null;

  return (
    <ModalShell
      title="Зафиксировать покупку"
      subtitle={modal.bond.name}
      eyebrow={null}
      busy={busy}
      mobileFillHeight
      mobileContentFillsHeight
      returnFocusTarget={modal.returnFocusTarget}
      onClose={onClose}
    >
      <AddPurchaseForm
        userId={userId}
        bond={modal.bond}
        onBusyChange={setBusy}
        onSuccess={onClose}
      />
    </ModalShell>
  );
}
