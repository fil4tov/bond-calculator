import { useState } from 'react';

import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { ModalShell } from '../ModalShell';
import { AddPurchaseForm } from '../PortfolioForms';
import type { PortfolioModalProps } from './types';

interface AddPurchaseModalProps extends PortfolioModalProps {
  userId: string;
  onSuccess?: (updatedBond: BondPortfolioItem) => void;
}

export function AddPurchaseModal({ modal, userId, onClose, onSuccess }: AddPurchaseModalProps) {
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
        onSuccess={(updatedBond) => (onSuccess ? onSuccess(updatedBond) : onClose())}
      />
    </ModalShell>
  );
}
