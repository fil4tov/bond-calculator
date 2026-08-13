import { useMemo, useRef, useState } from 'react';
import { FiPlus, FiRefreshCw } from 'react-icons/fi';

import { useDeletePortfolioBond, useDeletePortfolioOperation, usePortfolioBonds } from '#entities/bondPortfolio';
import type { BondOperation, BondPortfolioItem } from '#entities/bondPortfolio';
import { useUserStore } from '#entities/user';
import { Button, Typography } from '#shared/ui';
import { SiteHeader } from '#widgets/SiteHeader';

import { BondDetails } from './components/BondDetails';
import { BondPortfolioCard } from './components/BondPortfolioCard';
import { AddPurchaseForm, AddSaleForm, CreateBondForm } from './components/PortfolioForms';
import { ModalShell } from './components/ModalShell';
import { PortfolioSortControls } from './components/PortfolioSortControls';
import { PortfolioSummary } from './components/PortfolioSummary';
import styles from './PortfolioPage.module.scss';
import { readPortfolioSortPreference, sortPortfolioBonds, writePortfolioSortPreference } from './sorting';
import type { PortfolioSortField, PortfolioSortPreference } from './sorting';

interface PortfolioPageProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

type OpenModal =
  | { kind: 'create' }
  | { kind: 'details'; bond: BondPortfolioItem; returnFocusTarget: HTMLElement; focusOperationId?: string }
  | { kind: 'purchase'; bond: BondPortfolioItem; returnFocusTarget: HTMLElement }
  | { kind: 'sale'; bond: BondPortfolioItem; returnFocusTarget: HTMLElement }
  | { kind: 'confirm-bond'; bond: BondPortfolioItem; returnFocusTarget: HTMLElement }
  | null;

interface OperationDeleteConfirmation {
  bond: BondPortfolioItem;
  operation: BondOperation;
  detailsReturnFocusTarget: HTMLElement;
  returnFocusTarget: HTMLElement;
}

function LoadingState() {
  return (
    <div className={styles.skeletonList} aria-label="Загрузка портфеля" aria-live="polite">
      {[0, 1].map((item) => (
        <div key={item} className={styles.skeletonCard}>
          <span /><span /><span /><span />
        </div>
      ))}
    </div>
  );
}

export function PortfolioPage({ theme, toggleTheme }: PortfolioPageProps) {
  const user = useUserStore((state) => state.user);
  const userId = user?.id ?? '';
  const portfolio = usePortfolioBonds(userId);
  const hasPortfolioData = portfolio.data !== undefined;
  const portfolioData = portfolio.data;
  const initialPortfolioLoadError = portfolio.isError && !hasPortfolioData;
  const deleteBond = useDeletePortfolioBond(userId);
  const deleteOperation = useDeletePortfolioOperation(userId);
  const [modal, setModal] = useState<OpenModal>(null);
  const [operationDeleteConfirmation, setOperationDeleteConfirmation] = useState<OperationDeleteConfirmation | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const storedSortPreference = useMemo(() => readPortfolioSortPreference(userId), [userId]);
  const [sessionSortPreferences, setSessionSortPreferences] = useState<Record<string, PortfolioSortPreference>>({});
  const sortPreference = sessionSortPreferences[userId] ?? storedSortPreference;
  const addBondRef = useRef<HTMLButtonElement>(null);
  const sortedPortfolioData = useMemo(
    () => sortPortfolioBonds(portfolio.data ?? [], sortPreference),
    [portfolio.data, sortPreference],
  );

  const updateSortPreference = (next: PortfolioSortPreference) => {
    setSessionSortPreferences((current) => ({ ...current, [userId]: next }));
    if (userId) writePortfolioSortPreference(userId, next);
  };
  const handleSortFieldChange = (field: PortfolioSortField) => {
    updateSortPreference({ ...sortPreference, field });
  };
  const handleSortDirectionToggle = () => {
    updateSortPreference({
      ...sortPreference,
      direction: sortPreference.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const openCreate = () => { setModalBusy(false); setModal({ kind: 'create' }); };
  const openDetails = (bond: BondPortfolioItem, returnFocusTarget: HTMLElement) => {
    setModalBusy(false);
    setModal({ kind: 'details', bond, returnFocusTarget });
  };
  const openPurchase = (bond: BondPortfolioItem, returnFocusTarget: HTMLElement) => {
    setModalBusy(false);
    setModal({ kind: 'purchase', bond, returnFocusTarget });
  };
  const openSale = (bond: BondPortfolioItem, returnFocusTarget: HTMLElement) => {
    setModalBusy(false);
    setModal({ kind: 'sale', bond, returnFocusTarget });
  };
  const openBondDelete = (bond: BondPortfolioItem, returnFocusTarget: HTMLElement) => {
    setDeleteError(null);
    setModalBusy(false);
    setModal({ kind: 'confirm-bond', bond, returnFocusTarget });
  };
  const openOperationDelete = (
    bond: BondPortfolioItem,
    operation: BondOperation,
    detailsReturnFocusTarget: HTMLElement,
    returnFocusTarget: HTMLElement,
  ) => {
    setDeleteError(null);
    setModalBusy(false);
    setOperationDeleteConfirmation({
      bond,
      operation,
      detailsReturnFocusTarget,
      returnFocusTarget,
    });
  };
  const handleBondDelete = async (bond: BondPortfolioItem) => {
    setModalBusy(true);
    setDeleteError(null);
    try {
      await deleteBond.mutateAsync(bond.id);
      setModal(null);
    } catch {
      setDeleteError('Не удалось удалить облигацию из портфеля. Попробуйте ещё раз.');
    } finally {
      setModalBusy(false);
    }
  };
  const handleOperationDelete = async (bond: BondPortfolioItem, operation: BondOperation, detailsReturnFocusTarget: HTMLElement) => {
    setModalBusy(true);
    setDeleteError(null);
    try {
      const updatedBond = await deleteOperation.mutateAsync({ bondId: bond.id, operationId: operation.id });
      if (!updatedBond) {
        setOperationDeleteConfirmation(null);
        setModal(null);
        window.requestAnimationFrame(() => addBondRef.current?.focus());
        return;
      }
      const deletedIndex = bond.operations.findIndex((item) => item.id === operation.id);
      const neighboringOperation = updatedBond.operations[Math.min(Math.max(deletedIndex, 0), updatedBond.operations.length - 1)];
      setModal({
        kind: 'details',
        bond: updatedBond,
        returnFocusTarget: detailsReturnFocusTarget,
        focusOperationId: neighboringOperation?.id,
      });
      setOperationDeleteConfirmation(null);
    } catch {
      setDeleteError('Не удалось удалить операцию. Попробуйте ещё раз.');
    } finally {
      setModalBusy(false);
    }
  };
  const closeModal = () => {
    if (modalBusy) return;
    setModal(null);
  };
  const closeOperationDeleteConfirmation = () => {
    if (modalBusy) return;
    setOperationDeleteConfirmation(null);
  };

  return (
    <main className={styles.pageShell}>
      <SiteHeader theme={theme} toggleTheme={toggleTheme} />
      <section className={styles.intro}>
        <div>
          <Typography as="h1" variant="display">Портфель облигаций</Typography>
          <Typography>Денежный поток, сроки и покупки — в одном личном реестре.</Typography>
        </div>
        <Button ref={addBondRef} className={styles.addButton} type="button" trailingIcon={<FiPlus />} onClick={openCreate}>Добавить облигацию</Button>
      </section>

      <section className={styles.registry} aria-label="Облигации в портфеле">
        {portfolio.isPending && !hasPortfolioData ? <LoadingState /> : null}
        {initialPortfolioLoadError ? (
          <div className={styles.errorState} role="alert">
            <div>
              <h2>Не удалось загрузить портфель</h2>
              <p>{portfolio.error instanceof Error ? portfolio.error.message : 'Проверьте подключение и попробуйте снова.'}</p>
            </div>
            <Button type="button" variant="secondary" trailingIcon={<FiRefreshCw />} onClick={() => void portfolio.refetch()}>Повторить запрос</Button>
          </div>
        ) : null}
        {hasPortfolioData && portfolioData?.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyCoupon} aria-hidden="true"><span>₽</span></div>
            <h2>Портфель пока пуст</h2>
          </div>
        ) : null}
        {hasPortfolioData && (portfolioData?.length ?? 0) > 0 ? (
          <>
            <PortfolioSummary bonds={portfolioData ?? []} />
            <div className={styles.portfolioToolbar}>
              <PortfolioSortControls
                preference={sortPreference}
                onFieldChange={handleSortFieldChange}
                onDirectionToggle={handleSortDirectionToggle}
              />
            </div>
            <div className={styles.cardList}>
              {sortedPortfolioData.map((bond) => (
                <BondPortfolioCard
                  key={bond.id}
                  bond={bond}
                  onOpenDetails={(returnFocusTarget) => openDetails(bond, returnFocusTarget)}
                  onAddPurchase={(returnFocusTarget) => openPurchase(bond, returnFocusTarget)}
                  onAddSale={(returnFocusTarget) => openSale(bond, returnFocusTarget)}
                  onDelete={(returnFocusTarget) => openBondDelete(bond, returnFocusTarget)}
                  deleteDisabled={deleteBond.isPending}
                />
              ))}
            </div>
          </>
        ) : null}
      </section>

      {modal?.kind === 'create' ? (
        <ModalShell title="Добавить облигацию" eyebrow={null} busy={modalBusy} onClose={closeModal}>
          <CreateBondForm userId={userId} onBusyChange={setModalBusy} onSuccess={() => setModal(null)} />
        </ModalShell>
      ) : null}
      {modal?.kind === 'purchase' ? (
        <ModalShell
          title="Зафиксировать покупку"
          subtitle={modal.bond.name}
          eyebrow={null}
          busy={modalBusy}
          returnFocusTarget={modal.returnFocusTarget}
          onClose={closeModal}
        >
          <AddPurchaseForm userId={userId} bond={modal.bond} onBusyChange={setModalBusy} onSuccess={() => setModal(null)} />
        </ModalShell>
      ) : null}
      {modal?.kind === 'details' ? (
        <ModalShell
          title={modal.bond.name}
          eyebrow={null}
          busy={false}
          returnFocusTarget={modal.returnFocusTarget}
          onClose={closeModal}
        >
          <BondDetails
            bond={modal.bond}
            focusOperationId={modal.focusOperationId}
            operationDeleteDisabled={deleteOperation.isPending}
            onDeleteOperation={(operationId, returnFocusTarget) => {
              const operation = modal.bond.operations.find((item) => item.id === operationId);
              if (operation) openOperationDelete(modal.bond, operation, modal.returnFocusTarget, returnFocusTarget);
            }}
          />
        </ModalShell>
      ) : null}
      {modal?.kind === 'sale' ? (
        <ModalShell
          title="Зафиксировать продажу"
          subtitle={modal.bond.name}
          eyebrow={null}
          busy={modalBusy}
          returnFocusTarget={modal.returnFocusTarget}
          onClose={closeModal}
        >
          <AddSaleForm userId={userId} bond={modal.bond} onBusyChange={setModalBusy} onSuccess={() => setModal(null)} />
        </ModalShell>
      ) : null}
      {modal?.kind === 'confirm-bond' ? (
        <ModalShell
          title="Удалить облигацию"
          subtitle={modal.bond.name}
          eyebrow={null}
          busy={modalBusy}
          returnFocusTarget={modal.returnFocusTarget}
          onClose={closeModal}
        >
          <div className={styles.confirmation}>
            <p>
              Облигация и все её операции будут удалены без возможности восстановления.
            </p>
            {deleteError ? <p className={styles.confirmationError} role="alert">{deleteError}</p> : null}
            <div className={styles.confirmationActions}>
              <Button type="button" disabled={modalBusy} onClick={closeModal}>Отмена</Button>
              <Button
                type="button"
                variant="danger"
                disabled={modalBusy}
                onClick={() => void handleBondDelete(modal.bond)}
              >
                {modalBusy ? 'Удаляем…' : 'Удалить'}
              </Button>
            </div>
          </div>
        </ModalShell>
      ) : null}
      {operationDeleteConfirmation ? (
        <ModalShell
          title="Удалить операцию"
          subtitle={operationDeleteConfirmation.bond.name}
          eyebrow={null}
          busy={modalBusy}
          returnFocusTarget={operationDeleteConfirmation.returnFocusTarget}
          onClose={closeOperationDeleteConfirmation}
        >
          <div className={styles.confirmation}>
            <p>Операция будет удалена, а показатели позиции пересчитаются.</p>
            {deleteError ? <p className={styles.confirmationError} role="alert">{deleteError}</p> : null}
            <div className={styles.confirmationActions}>
              <Button type="button" disabled={modalBusy} onClick={closeOperationDeleteConfirmation}>Отмена</Button>
              <Button
                type="button"
                variant="danger"
                disabled={modalBusy}
                onClick={() => void handleOperationDelete(
                  operationDeleteConfirmation.bond,
                  operationDeleteConfirmation.operation,
                  operationDeleteConfirmation.detailsReturnFocusTarget,
                )}
              >
                {modalBusy ? 'Удаляем…' : 'Удалить'}
              </Button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </main>
  );
}
