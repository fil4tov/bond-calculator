import { useRef, useState } from 'react';
import { FiCheck, FiChevronDown } from 'react-icons/fi';

import { Dropdown } from '#shared/ui';

import styles from '../../PortfolioSortControls.module.scss';
import type { PortfolioSortField } from '../../types';
import { SORT_OPTIONS } from './constants';

interface SortFieldMenuProps {
  field: PortfolioSortField;
  onChange: (field: PortfolioSortField) => void;
}

export function SortFieldMenu({ field, onChange }: SortFieldMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedOption = SORT_OPTIONS.find((option) => option.field === field) ?? SORT_OPTIONS[1]!;

  return (
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
          const selected = option.field === field;
          return (
            <button
              key={option.field}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              className={styles.option}
              onClick={() => {
                onChange(option.field);
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
  );
}
