import { FiArrowDown, FiArrowUp } from 'react-icons/fi';

import styles from '../../PortfolioSortControls.module.scss';
import type { SortDirection } from '../../types';

interface SortDirectionButtonProps {
  direction: SortDirection;
  onToggle: () => void;
}

export function SortDirectionButton({ direction, onToggle }: SortDirectionButtonProps) {
  const isAscending = direction === 'asc';
  const label = isAscending ? 'По возрастанию' : 'По убыванию';
  const nextLabel = isAscending ? 'по убыванию' : 'по возрастанию';

  return (
    <button
      type="button"
      className={styles.direction}
      aria-pressed={!isAscending}
      aria-label={`${label}. Переключить ${nextLabel}`}
      title={label}
      onClick={onToggle}
    >
      {isAscending ? <FiArrowUp aria-hidden="true" /> : <FiArrowDown aria-hidden="true" />}
    </button>
  );
}
