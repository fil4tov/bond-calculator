import styles from './PortfolioSortControls.module.scss';
import { SortDirectionButton, SortFieldMenu } from './components';
import type { PortfolioSortField, PortfolioSortPreference } from './types';

interface PortfolioSortControlsProps {
  preference: PortfolioSortPreference;
  onFieldChange: (field: PortfolioSortField) => void;
  onDirectionToggle: () => void;
}

export function PortfolioSortControls({
  preference,
  onFieldChange,
  onDirectionToggle,
}: PortfolioSortControlsProps) {
  return (
    <div className={styles.controls} aria-label="Сортировка облигаций">
      <SortFieldMenu field={preference.field} onChange={onFieldChange} />
      <SortDirectionButton direction={preference.direction} onToggle={onDirectionToggle} />
    </div>
  );
}
