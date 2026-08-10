import { useState } from 'react';
import { FiPlus, FiRefreshCw } from 'react-icons/fi';

import { useDeletePortfolioBond, usePortfolioBonds } from '#entities/bondPortfolio';
import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { useUserStore } from '#entities/user';
import { Button, Typography } from '#shared/ui';
import { SiteHeader } from '#widgets/SiteHeader';

import { BondDetails } from './components/BondDetails';
import { BondPortfolioCard } from './components/BondPortfolioCard';
import { AddPurchaseForm, CreateBondForm } from './components/PortfolioForms';
import { ModalShell } from './components/ModalShell';
import styles from './PortfolioPage.module.scss';

interface PortfolioPageProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

type OpenModal =
  | { kind: 'create' }
  | { kind: 'details'; bond: BondPortfolioItem; returnFocusTarget: HTMLElement }
  | { kind: 'purchase'; bond: BondPortfolioItem; returnFocusTarget: HTMLElement }
  | null;

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
  const deleteBond = useDeletePortfolioBond(userId);
  const [modal, setModal] = useState<OpenModal>(null);
  const [modalBusy, setModalBusy] = useState(false);

  const openCreate = () => { setModalBusy(false); setModal({ kind: 'create' }); };
  const openDetails = (bond: BondPortfolioItem, returnFocusTarget: HTMLElement) => {
    setModalBusy(false);
    setModal({ kind: 'details', bond, returnFocusTarget });
  };
  const openPurchase = (bond: BondPortfolioItem, returnFocusTarget: HTMLElement) => {
    setModalBusy(false);
    setModal({ kind: 'purchase', bond, returnFocusTarget });
  };
  const handleDelete = async (bond: BondPortfolioItem) => {
    if (!window.confirm('Вы точно хотите удалить облигацию из портфеля? Это действие необратимо.')) return;
    try {
      await deleteBond.mutateAsync(bond.id);
    } catch {
      window.alert('Не удалось удалить облигацию из портфеля. Попробуйте ещё раз.');
    }
  };
  const closeModal = () => { if (!modalBusy) setModal(null); };

  return (
    <main className={styles.pageShell}>
      <SiteHeader theme={theme} toggleTheme={toggleTheme} />
      <section className={styles.intro}>
        <div>
          <Typography as="h1" variant="display">Портфель облигаций</Typography>
          <Typography>Денежный поток, сроки и покупки — в одном личном реестре.</Typography>
        </div>
        <Button className={styles.addButton} type="button" trailingIcon={<FiPlus />} onClick={openCreate}>Добавить облигацию</Button>
      </section>

      <section className={styles.registry} aria-label="Облигации в портфеле">
        {portfolio.isPending ? <LoadingState /> : null}
        {portfolio.isError ? (
          <div className={styles.errorState} role="alert">
            <div>
              <h2>Не удалось загрузить портфель</h2>
              <p>{portfolio.error instanceof Error ? portfolio.error.message : 'Проверьте подключение и попробуйте снова.'}</p>
            </div>
            <Button type="button" variant="secondary" trailingIcon={<FiRefreshCw />} onClick={() => void portfolio.refetch()}>Повторить запрос</Button>
          </div>
        ) : null}
        {portfolio.isSuccess && portfolio.data.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyCoupon} aria-hidden="true"><span>₽</span></div>
            <h2>Портфель пока пуст</h2>
          </div>
        ) : null}
        {portfolio.isSuccess && portfolio.data.length > 0 ? (
          <div className={styles.cardList}>
            {portfolio.data.map((bond) => (
              <BondPortfolioCard
                key={bond.id}
                bond={bond}
                onOpenDetails={(returnFocusTarget) => openDetails(bond, returnFocusTarget)}
                onAddPurchase={(returnFocusTarget) => openPurchase(bond, returnFocusTarget)}
                onDelete={() => void handleDelete(bond)}
                deleteDisabled={deleteBond.isPending}
              />
            ))}
          </div>
        ) : null}
      </section>

      {modal?.kind === 'create' ? (
        <ModalShell title="Добавить облигацию" eyebrow={null} busy={modalBusy} onClose={closeModal}>
          <CreateBondForm userId={userId} onBusyChange={setModalBusy} onSuccess={() => setModal(null)} />
        </ModalShell>
      ) : null}
      {modal?.kind === 'purchase' ? (
        <ModalShell
          title="Добавить покупку"
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
          <BondDetails bond={modal.bond} />
        </ModalShell>
      ) : null}
    </main>
  );
}
