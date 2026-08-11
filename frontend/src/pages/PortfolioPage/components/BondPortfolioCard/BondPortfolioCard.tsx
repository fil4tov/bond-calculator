import { useId, useRef, useState } from 'react';

import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { Dropdown, Tooltip } from '#shared/ui';

import { couponYieldDescription, formatDayCount, formatMoney, formatPercent, formatYearCount } from '../../utils';
import styles from './BondPortfolioCard.module.scss';

interface BondPortfolioCardProps {
  bond: BondPortfolioItem;
  onOpenDetails: (returnFocusTarget: HTMLElement) => void;
  onAddPurchase: (returnFocusTarget: HTMLElement) => void;
  onAddSale: (returnFocusTarget: HTMLElement) => void;
  onDelete: (returnFocusTarget: HTMLElement) => void;
  deleteDisabled: boolean;
}

function maturityLabel(bond: BondPortfolioItem) {
  if (bond.status === 'matured') return 'Погашена';
  if (bond.status === 'payment_pending') return 'Ожидается выплата';
  const { years, months, daysUntil } = bond.maturityRemaining;
  if (years > 0) return `До погашения ${formatYearCount(years)} ${months} мес.`;
  if (months > 0) return `До погашения ${months} мес.`;
  return `До погашения ${daysUntil.toLocaleString('ru-RU')} дн.`;
}

function couponProgress(periodDays: number, elapsedPeriodDays: number) {
  if (periodDays <= 0) return 0;
  const value = (elapsedPeriodDays / periodDays) * 100;
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}

export function BondPortfolioCard({
  bond,
  onOpenDetails,
  onAddPurchase,
  onAddSale,
  onDelete,
  deleteDisabled,
}: BondPortfolioCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const actionsRef = useRef<HTMLButtonElement>(null);
  const summaryId = useId();
  const matured = bond.status === 'matured';
  const progress = bond.nextCoupon
    ? couponProgress(bond.nextCoupon.periodDays, bond.nextCoupon.elapsedPeriodDays)
    : 0;
  const daysUntilCoupon = bond.nextCoupon ? formatDayCount(bond.nextCoupon.daysUntil) : '';
  const emptyCouponLabel = matured
    ? 'Облигация погашена'
    : bond.status === 'payment_pending'
      ? 'Ожидается выплата'
      : 'Купонные выплаты не предусмотрены';

  return (
    <article className={`${styles.card} ${matured ? styles.matured : ''}`} aria-label={bond.name}>
      <div
        className={styles.main}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty('--hover-x', `${event.clientX - bounds.left}px`);
          event.currentTarget.style.setProperty('--hover-y', `${event.clientY - bounds.top}px`);
        }}
      >
        <div className={styles.mainContent}>
        <span id={summaryId} className={styles.summary}>
          <span className={styles.identity}>
            <strong className={styles.name}>{bond.name}</strong>
            <span className={styles.meta}>
              <span>{bond.totalQuantity.toLocaleString('ru-RU')} шт.</span>
              <span>{maturityLabel(bond)}</span>
            </span>
          </span>
          <span className={styles.value}>
            <strong>{formatMoney(bond.positionCostBasis)}</strong>
            <span className={styles.yieldLine}>
              {formatPercent(bond.calendarYearCouponYieldPercent)} за {bond.couponYieldYear} год
              <span className={styles.yieldHelp}>
                <Tooltip
                  label={`Как рассчитывается купонная доходность за ${bond.couponYieldYear} год`}
                  align="right"
                >
                  {couponYieldDescription(bond.couponYieldYear)}
                </Tooltip>
              </span>
            </span>
          </span>
        </span>

        {bond.nextCoupon ? (
          <span
            className={styles.couponTrack}
            role="progressbar"
            aria-label={`Купонный период ${bond.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-valuetext={`Пройдено ${progress.toLocaleString('ru-RU')} %. Ближайший купон через ${daysUntilCoupon}, сумма ${formatMoney(bond.nextCoupon.amount)}`}
          >
            <span
              className={styles.couponFill}
              data-progress-fill
              aria-hidden="true"
              style={{ width: `${progress}%` }}
            />
            <span className={styles.couponCopy}>
              <span>Ближайший купон через {daysUntilCoupon}</span>
              <strong>{formatMoney(bond.nextCoupon.amount)}</strong>
            </span>
          </span>
        ) : (
          <span className={`${styles.couponTrack} ${styles.redeemedTrack}`}>
            <span className={styles.couponCopy}>{emptyCouponLabel}</span>
          </span>
        )}
        </div>
        <button
          type="button"
          className={styles.detailsTrigger}
          aria-label={`Открыть сведения об облигации ${bond.name}`}
          aria-describedby={summaryId}
          onClick={(event) => onOpenDetails(event.currentTarget)}
        />
      </div>

      <Dropdown
        open={menuOpen}
        onOpenChange={setMenuOpen}
        mobileMode="anchored"
        className={styles.actions}
        contentClassName={styles.actionsMenu}
        trigger={(triggerProps) => (
          <button
            ref={(element) => {
              triggerProps.ref.current = element;
              actionsRef.current = element;
            }}
            type="button"
            className={styles.actionsTrigger}
            aria-label={`Действия с облигацией ${bond.name}`}
            aria-expanded={triggerProps['aria-expanded']}
            aria-controls={triggerProps['aria-controls']}
            onClick={triggerProps.onClick}
          >
            <span aria-hidden="true">•••</span>
          </button>
        )}
      >
        <div>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setMenuOpen(false);
              if (actionsRef.current) onAddPurchase(actionsRef.current);
            }}
          >
            Зафиксировать покупку
          </button>
          <button
            type="button"
            className={styles.menuItem}
            disabled={bond.totalQuantity <= 0}
            onClick={() => {
              setMenuOpen(false);
              if (actionsRef.current) onAddSale(actionsRef.current);
            }}
          >
            Зафиксировать продажу
          </button>
          <button
            type="button"
            className={`${styles.menuItem} ${styles.deleteMenuItem}`}
            disabled={deleteDisabled}
            onClick={() => {
              setMenuOpen(false);
              if (actionsRef.current) onDelete(actionsRef.current);
            }}
          >
            Удалить из портфеля
          </button>
        </div>
      </Dropdown>
    </article>
  );
}
