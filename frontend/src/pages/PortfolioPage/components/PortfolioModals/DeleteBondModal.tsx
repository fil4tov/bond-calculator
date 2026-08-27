import { useState } from 'react';

import { useDeletePortfolioBond } from '#entities/bondPortfolio';
import { ModalShell } from '../ModalShell';
import { ConfirmationContent } from './components';
import type { PortfolioModalProps } from './types';

interface DeleteBondModalProps extends PortfolioModalProps {
  userId: string;
  onDeleted?: () => void;
}

export function DeleteBondModal({ modal, userId, onClose, onDeleted }: DeleteBondModalProps) {
  const deleteBond = useDeletePortfolioBond(userId);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (modal?.kind !== 'confirm-bond') return null;

  const closeModal = () => {
    setDeleteError(null);
    onClose();
  };

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await deleteBond.mutateAsync(modal.bond.id);
      setDeleteError(null);
      if (onDeleted) onDeleted();
      else onClose();
    } catch {
      setDeleteError('Не удалось удалить облигацию из портфеля. Попробуйте ещё раз.');
    }
  };

  return (
    <ModalShell
      title="Удалить облигацию"
      subtitle={modal.bond.name}
      eyebrow={null}
      busy={deleteBond.isPending}
      returnFocusTarget={modal.returnFocusTarget}
      onClose={closeModal}
    >
      <ConfirmationContent
        error={deleteError}
        busy={deleteBond.isPending}
        onCancel={closeModal}
        onConfirm={() => void handleDelete()}
      >
        Облигация и все её операции будут удалены без возможности восстановления.
      </ConfirmationContent>
    </ModalShell>
  );
}
