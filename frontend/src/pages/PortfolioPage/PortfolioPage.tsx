import { useMemo, useRef, useState } from 'react';
import { FiPlus, FiRefreshCw } from 'react-icons/fi';

import { usePortfolioBonds } from '#entities/bondPortfolio';
import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { useUserStore } from '#entities/user';
import { Button, Typography } from '#shared/ui';
import { SiteHeader } from '#widgets/SiteHeader';

import {
  BondPortfolioCard,
  BondDetailsModal,
  CreateBondModal,
  PortfolioLoadingState,
  PortfolioSortControls,
  PortfolioSummary,
  readPortfolioSortPreference,
  sortPortfolioBonds,
  writePortfolioSortPreference,
} from './components';
import type { OpenPortfolioModal } from './components';
import type {
  PortfolioSortField,
  PortfolioSortPreference,
} from './components';
import styles from './PortfolioPage.module.scss';

interface PortfolioPageProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function PortfolioPage({ theme, toggleTheme }: PortfolioPageProps) {
  const user = useUserStore((state) => state.user);
  const userId = user?.id ?? '';
  const portfolio = usePortfolioBonds(userId);
  const hasPortfolioData = portfolio.data !== undefined;
  const portfolioData = portfolio.data;
  const initialPortfolioLoadError = portfolio.isError && !hasPortfolioData;
  const [modal, setModal] = useState<OpenPortfolioModal>(null);
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

  const openCreate = () => setModal({ kind: 'create' });
  const openDetails = (bond: BondPortfolioItem, returnFocusTarget: HTMLElement) => {
    setModal({ kind: 'details', bond, returnFocusTarget });
  };
  const closeModal = () => setModal(null);

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
        {portfolio.isPending && !hasPortfolioData ? <PortfolioLoadingState /> : null}
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
              <p className={styles.issueCount} aria-live="polite">
                Всего выпусков: <strong>{portfolioData?.length ?? 0}</strong>
              </p>
            </div>
            <div className={styles.cardList}>
              {sortedPortfolioData.map((bond) => (
                <BondPortfolioCard
                  key={bond.id}
                  bond={bond}
                  onOpenDetails={(returnFocusTarget) => openDetails(bond, returnFocusTarget)}
                />
              ))}
            </div>
          </>
        ) : null}
      </section>

      <CreateBondModal modal={modal} userId={userId} onClose={closeModal} />
      <BondDetailsModal
        modal={modal}
        userId={userId}
        addBondButtonRef={addBondRef}
        onClose={closeModal}
        onModalChange={setModal}
      />
    </main>
  );
}
