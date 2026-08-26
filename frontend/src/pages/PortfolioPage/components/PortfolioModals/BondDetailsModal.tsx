import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { useDeletePortfolioOperation, useRefreshCouponSchedule } from '#entities/bondPortfolio';
import { Modal } from '#shared/ui';

import { BondDetails } from '../BondDetails';
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
  const refreshCouponSchedule = useRefreshCouponSchedule(userId);
  const modalRef = useRef(modal);
  const [confirmation, setConfirmation] = useState<OperationDeleteConfirmation | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    modalRef.current = modal;
  }, [modal]);

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
      <Modal
        title={modal.bond.name}
        busy={false}
        returnFocusTarget={modal.returnFocusTarget}
        onClose={onClose}
        width="extraWide"
        contentLayout="fullBleed"
        mobileFillHeight
        renderContent={({ titleId, closeButton }) => (
          <BondDetails
            bond={modal.bond}
            titleId={titleId}
            closeButton={closeButton}
            focusOperationId={modal.focusOperationId}
            operationDeleteDisabled={deleteOperation.isPending}
            onRefreshCouponSchedule={async () => {
              const updatedBond = await refreshCouponSchedule.mutateAsync(modal.bond);
              const currentModal = modalRef.current;
              if (currentModal?.kind !== 'details' || currentModal.bond.id !== updatedBond.id) {
                return;
              }
              onModalChange({ ...currentModal, bond: updatedBond });
            }}
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
        )}
      />
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
