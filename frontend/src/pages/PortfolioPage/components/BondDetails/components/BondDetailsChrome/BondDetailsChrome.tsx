import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { FiBarChart2, FiFileText, FiPercent, FiRepeat } from 'react-icons/fi';

import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { currentMarketValue, formatMoney } from '../../../../utils';
import { BOND_DETAILS_SECTIONS } from '../../constants';
import type { BondDetailsSection } from '../../types';
import { BondStatus } from '../BondStatus';
import styles from './BondDetailsChrome.module.scss';

const SECTION_ICONS = {
  issue: FiFileText,
  position: FiBarChart2,
  coupons: FiPercent,
  operations: FiRepeat,
} satisfies Record<BondDetailsSection, typeof FiFileText>;

interface BondDetailsChromeProps {
  bond: BondPortfolioItem;
  activeSection: BondDetailsSection;
  closeButton: ReactNode;
  onSectionChange: (section: BondDetailsSection) => void;
}

function Navigation({
  activeSection,
  operationCount,
  onSectionChange,
}: Pick<BondDetailsChromeProps, 'activeSection' | 'onSectionChange'> & { operationCount: number }) {
  const navigationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const navigation = navigationRef.current;
    const selectedTab = navigation?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!navigation || !selectedTab) return;

    const navigationBounds = navigation.getBoundingClientRect();
    const tabBounds = selectedTab.getBoundingClientRect();
    if (
      navigationBounds.right <= navigationBounds.left
      || tabBounds.right <= tabBounds.left
    ) return;
    const edgeInset = 4;
    const visibleLeft = navigationBounds.left + edgeInset;
    const visibleRight = navigationBounds.right - edgeInset;
    const offset = tabBounds.left < visibleLeft
      ? tabBounds.left - visibleLeft
      : tabBounds.right > visibleRight
        ? tabBounds.right - visibleRight
        : 0;
    if (offset === 0) return;

    const nextScrollLeft = navigation.scrollLeft + offset;
    if (typeof navigation.scrollTo !== 'function') {
      navigation.scrollLeft = nextScrollLeft;
      return;
    }
    navigation.scrollTo({
      left: nextScrollLeft,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
  }, [activeSection]);

  return (
    <div
      ref={navigationRef}
      className={styles.navigation}
      role="tablist"
      aria-label="Разделы сведений об облигации"
    >
      {BOND_DETAILS_SECTIONS.map((section) => {
        const Icon = SECTION_ICONS[section.id];
        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            className={styles.navigationItem}
            aria-selected={activeSection === section.id}
            onClick={() => onSectionChange(section.id)}
          >
            <span className={styles.navigationIcon}><Icon aria-hidden="true" /></span>
            <span>{section.label}</span>
            {section.id === 'operations' ? (
              <small aria-hidden="true">{operationCount.toLocaleString('ru-RU')}</small>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function BondDetailsChrome({
  bond,
  activeSection,
  closeButton,
  onSectionChange,
}: BondDetailsChromeProps) {
  const marketValue = currentMarketValue(bond);

  return (
    <div className={styles.chrome}>
      <aside className={styles.sidebar} aria-label="Навигация по облигации">
        <div>
          <BondStatus bond={bond} />
          <h2 className={styles.title}>{bond.name}</h2>
        </div>
        <Navigation
          activeSection={activeSection}
          operationCount={bond.operations.length}
          onSectionChange={onSectionChange}
        />
        <div className={styles.sidebarSummary}>
          <span>Стоимость позиции</span>
          <strong>{marketValue === null ? '—' : formatMoney(marketValue)}</strong>
        </div>
      </aside>

      <div className={styles.closeSlot}>{closeButton}</div>
    </div>
  );
}
