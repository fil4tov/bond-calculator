import { useState } from 'react';

import { ModalShell } from '../ModalShell';
import { CreateBondForm } from '../PortfolioForms';
import type { PortfolioModalProps } from './types';

interface CreateBondModalProps extends PortfolioModalProps {
  userId: string;
}

export function CreateBondModal({ modal, userId, onClose }: CreateBondModalProps) {
  const [busy, setBusy] = useState(false);

  if (modal?.kind !== 'create') return null;

  return (
    <ModalShell
      title="Добавить облигацию"
      eyebrow={null}
      busy={busy}
      mobileFillHeight
      onClose={onClose}
    >
      <CreateBondForm userId={userId} onBusyChange={setBusy} onSuccess={onClose} />
    </ModalShell>
  );
}
