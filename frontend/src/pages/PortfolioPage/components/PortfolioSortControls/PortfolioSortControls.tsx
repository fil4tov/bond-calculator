import { useRef, useState } from 'react';
import { FiArrowDown, FiArrowUp, FiCheck, FiChevronDown } from 'react-icons/fi';

import { Dropdown } from '#shared/ui';

import type { PortfolioSortField, PortfolioSortPreference } from '../../sorting';
import styles from './PortfolioSortControls.module.scss';

interface PortfolioSortControlsProps {
  preference: PortfolioSortPreference;
  onFieldChange: (field: PortfolioSortField) => void;
  onDirectionToggle: () => void;
}

const SORT_OPTIONS: ReadonlyArray<{ field: PortfolioSortField; label: string }> = [
  { field: 'name', label: 'По имени' },
  { field: 'createdAt', label: 'По дате добавления' },
  { field: 'nextCoupon', label: 'По ближайшей выплате купона' },
  { field: 'firstPurchase', label: 'По дате первой покупки' },
  { field: 'portfolioShare', label: 'По доле портфеля' },
];

export function PortfolioSortControls({ preference, onFieldChange, onDirectionToggle }: PortfolioSortControlsProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedOption = SORT_OPTIONS.find((option) => option.field === preference.field) ?? SORT_OPTIONS[1]!;
  const isAscending = preference.direction === 'asc';
  const directionLabel = isAscending ? 'По возрастанию' : 'По убыванию';
  const nextDirectionLabel = isAscending ? 'по убыванию' : 'по возрастанию';

  return (
    <div className={styles.controls} aria-label="Сортировка облигаций">
      <Dropdown
        open={open}
        onOpenChange={setOpen}
        mobileMode="anchored"
        className={styles.dropdown}
        contentClassName={styles.menu}
        trigger={(triggerProps) => (
          <button
            ref={(element) => {
              triggerProps.ref.current = element;
              triggerRef.current = element;
            }}
            type="button"
            className={styles.trigger}
            aria-label={`Критерий сортировки: ${selectedOption.label}`}
            aria-expanded={triggerProps['aria-expanded']}
            aria-controls={triggerProps['aria-controls']}
            onClick={triggerProps.onClick}
          >
            <span>{selectedOption.label}</span>
            <FiChevronDown className={open ? styles.chevronOpen : ''} aria-hidden="true" />
          </button>
        )}
      >
        <div role="menu" aria-label="Критерий сортировки">
          {SORT_OPTIONS.map((option) => {
            const selected = option.field === preference.field;
            return (
              <button
                key={option.field}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={styles.option}
                onClick={() => {
                  onFieldChange(option.field);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <span>{option.label}</span>
                {selected ? <FiCheck aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </Dropdown>

      <button
        type="button"
        className={styles.direction}
        aria-pressed={!isAscending}
        aria-label={`${directionLabel}. Переключить ${nextDirectionLabel}`}
        title={directionLabel}
        onClick={onDirectionToggle}
      >
        {isAscending ? <FiArrowUp aria-hidden="true" /> : <FiArrowDown aria-hidden="true" />}
      </button>
    </div>
  );
}
