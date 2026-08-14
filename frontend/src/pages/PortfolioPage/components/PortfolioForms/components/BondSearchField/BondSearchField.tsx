import { useId, useState } from 'react';

import type { TInvestBondSearchItem } from '#entities/bondPortfolio';
import { TextField } from '#shared/ui';

import styles from '../../PortfolioForms.module.scss';

const MAX_VISIBLE_SEARCH_RESULTS = 5;

interface BondSearchFieldProps {
  value: string;
  selected: boolean;
  items?: TInvestBondSearchItem[];
  pending: boolean;
  error: boolean;
  onChange: (value: string) => void;
  onSelect: (bond: TInvestBondSearchItem) => void;
  onRetry: () => void;
}

export function BondSearchField({
  value,
  selected,
  items,
  pending,
  error,
  onChange,
  onSelect,
  onRetry,
}: BondSearchFieldProps) {
  const listboxId = `${useId()}-ticker-options`;
  const [open, setOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const visibleItems = items?.slice(0, MAX_VISIBLE_SEARCH_RESULTS);
  const showLookup = open && value.trim().length >= 2 && !selected;

  const changeValue = (nextValue: string) => {
    onChange(nextValue);
    setOpen(nextValue.trim().length >= 2);
    setActiveOptionIndex(-1);
  };

  const selectItem = (item: TInvestBondSearchItem) => {
    onSelect(item);
    setOpen(false);
    setActiveOptionIndex(-1);
  };

  return (
    <div className={`${styles.tickerField} ${selected ? styles.tickerFieldSelected : ''}`}>
      <TextField
        name="bondSearch"
        label="Название или тикер"
        placeholder="Например, ОФЗ или SU26238"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showLookup}
        aria-controls={showLookup ? listboxId : undefined}
        aria-activedescendant={showLookup && activeOptionIndex >= 0 ? `${listboxId}-option-${activeOptionIndex}` : undefined}
        value={value}
        onChange={(event) => changeValue(event.target.value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && visibleItems?.length) {
            event.preventDefault();
            setOpen(true);
            setActiveOptionIndex((index) => (index + 1) % visibleItems.length);
          }
          if (event.key === 'ArrowUp' && visibleItems?.length) {
            event.preventDefault();
            setOpen(true);
            setActiveOptionIndex((index) => index <= 0 ? visibleItems.length - 1 : index - 1);
          }
          if (event.key === 'Enter' && activeOptionIndex >= 0 && visibleItems?.[activeOptionIndex]) {
            event.preventDefault();
            selectItem(visibleItems[activeOptionIndex]);
          }
          if (event.key === 'Escape') {
            setOpen(false);
            setActiveOptionIndex(-1);
          }
        }}
      />
      {showLookup ? (
        <div id={listboxId} className={styles.lookupMenu} role="listbox" aria-label="Результаты поиска облигаций">
          {pending ? <p aria-live="polite">Ищем облигации…</p> : null}
          {!pending ? visibleItems?.map((item, index) => (
            <button
              id={`${listboxId}-option-${index}`}
              key={item.instrumentUid}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={activeOptionIndex === index}
              className={styles.lookupOption}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveOptionIndex(index)}
              onClick={() => selectItem(item)}
            >
              <strong>{item.ticker}</strong><span>{item.name}</span>
            </button>
          )) : null}
          {!pending && items?.length === 0 ? <p>Облигации не найдены</p> : null}
          {error ? (
            <p className={styles.inlineError} role="alert">
              Не удалось найти облигации.{' '}
              <button type="button" onClick={onRetry}>Повторить поиск</button>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
