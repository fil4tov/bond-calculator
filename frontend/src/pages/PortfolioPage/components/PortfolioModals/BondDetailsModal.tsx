import { useState } from 'react';
import type { RefObject } from 'react';

import { useDeletePortfolioOperation } from '#entities/bondPortfolio';

import { BondDetails } from '../BondDetails';
import { ModalShell } from '../ModalShell';
import { DeleteOperationModal } from './DeleteOperationModal';
import type { OperationDeleteConfirmation } from './DeleteOperationModal';
import type { OpenPortfolioModal, PortfolioModalProps } from './types';

interface BondDetailsModalProps extends PortfolioModalProps {
  userId: string;
  addBondButtonRef: RefObject<HTMLButtonElement | null>;
  onModalChange: (modal: OpenPortfolioModal) => void;
}

export function BondDetailsModal({
  modal,
  userId,
  addBondButtonRef,
  onClose,
  onModalChange,
}: BondDetailsModalProps) {
  const deleteOperation = useDeletePortfolioOperation(userId);
  const [confirmation, setConfirmation] = useState<OperationDeleteConfirmation | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (modal?.kind !== 'details') return null;

  const closeConfirmation = () => {
    if (!deleteOperation.isPending) setConfirmation(null);
  };

  const handleOperationDelete = async (target: OperationDeleteConfirmation) => {
    setDeleteError(null);
    try {
      const updatedBond = await deleteOperation.mutateAsync({
        bondId: target.bond.id,
        operationId: target.operation.id,
      });
      if (!updatedBond) {
        setConfirmation(null);
        onModalChange(null);
        window.requestAnimationFrame(() => addBondButtonRef.current?.focus());
        return;
      }

      const deletedIndex = target.bond.operations.findIndex(
        (operation) => operation.id === target.operation.id,
      );
      const neighboringOperation = updatedBond.operations[
        Math.min(Math.max(deletedIndex, 0), updatedBond.operations.length - 1)
      ];
      onModalChange({
        kind: 'details',
        bond: updatedBond,
        returnFocusTarget: target.detailsReturnFocusTarget,
        focusOperationId: neighboringOperation?.id,
      });
      setConfirmation(null);
    } catch {
      setDeleteError('Не удалось удалить операцию. Попробуйте ещё раз.');
    }
  };

  return (
    <>
      <ModalShell
        title={modal.bond.name}
        eyebrow={null}
        busy={false}
        returnFocusTarget={modal.returnFocusTarget}
        onClose={onClose}
      >
        <BondDetails
          bond={modal.bond}
          focusOperationId={modal.focusOperationId}
          operationDeleteDisabled={deleteOperation.isPending}
          onDeleteOperation={(operationId, returnFocusTarget) => {
            const operation = modal.bond.operations.find((item) => item.id === operationId);
            if (!operation) return;
            setDeleteError(null);
            setConfirmation({
              bond: modal.bond,
              operation,
              detailsReturnFocusTarget: modal.returnFocusTarget,
              returnFocusTarget,
            });
          }}
        />
      </ModalShell>
      <DeleteOperationModal
        confirmation={confirmation}
        busy={deleteOperation.isPending}
        deleteError={deleteError}
        onClose={closeConfirmation}
        onDelete={(target) => void handleOperationDelete(target)}
      />
    </>
  );
}
