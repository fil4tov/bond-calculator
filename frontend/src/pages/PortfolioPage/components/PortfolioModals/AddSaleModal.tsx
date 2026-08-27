import { useState } from 'react';

import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { ModalShell } from '../ModalShell';
import { AddSaleForm } from '../PortfolioForms';
import type { PortfolioModalProps } from './types';

interface AddSaleModalProps extends PortfolioModalProps {
  userId: string;
  onSuccess?: (updatedBond: BondPortfolioItem) => void;
}

export function AddSaleModal({ modal, userId, onClose, onSuccess }: AddSaleModalProps) {
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
        onSuccess={(updatedBond) => (onSuccess ? onSuccess(updatedBond) : onClose())}
      />
    </ModalShell>
  );
}
