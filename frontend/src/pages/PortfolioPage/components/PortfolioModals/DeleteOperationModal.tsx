import type { BondOperation, BondPortfolioItem } from '#entities/bondPortfolio';
import { ModalShell } from '../ModalShell';
import { ConfirmationContent } from './components';

export interface OperationDeleteConfirmation {
  bond: BondPortfolioItem;
  operation: BondOperation;
  detailsReturnFocusTarget: HTMLElement;
  returnFocusTarget: HTMLElement;
}

interface DeleteOperationModalProps {
  confirmation: OperationDeleteConfirmation | null;
  busy: boolean;
  deleteError: string | null;
  onClose: () => void;
  onDelete: (confirmation: OperationDeleteConfirmation) => void;
}

export function DeleteOperationModal({
  confirmation,
  busy,
  deleteError,
  onClose,
  onDelete,
}: DeleteOperationModalProps) {
  if (!confirmation) return null;

  return (
    <ModalShell
      title="Удалить операцию"
      subtitle={confirmation.bond.name}
      eyebrow={null}
      busy={busy}
      returnFocusTarget={confirmation.returnFocusTarget}
      onClose={onClose}
    >
      <ConfirmationContent
        error={deleteError}
        busy={busy}
        onCancel={onClose}
        onConfirm={() => onDelete(confirmation)}
      >
        Операция будет удалена, а показатели позиции пересчитаются.
      </ConfirmationContent>
    </ModalShell>
  );
}
