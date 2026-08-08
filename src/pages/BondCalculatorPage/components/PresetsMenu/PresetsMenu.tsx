import { CiCircleList } from 'react-icons/ci';
import { FiTrash2 } from 'react-icons/fi';

import { calculatePresetYields } from '#entities/bondCalculation';
import type { SavedBondCalculation } from '#entities/bondCalculation';
import { Dropdown, IconButton } from '#shared/ui';

import styles from '../../BondCalculatorPage.module.scss';

interface PresetsMenuProps {
  presets: SavedBondCalculation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (preset: SavedBondCalculation) => void;
  onDelete: (preset: SavedBondCalculation) => void;
}

const percentFormatter = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PresetsMenu({ presets, open, onOpenChange, onRestore, onDelete }: PresetsMenuProps) {
  return (
    <Dropdown
      open={open}
      onOpenChange={onOpenChange}
      contentClassName={styles.presetsDropdown}
      trigger={(triggerProps) => (
        <IconButton
          {...triggerProps}
          icon={<CiCircleList />}
          type="button"
          aria-label={open ? 'Закрыть сохранённые расчёты' : 'Открыть сохранённые расчёты'}
        />
      )}
    >
      <div className={styles.presetsHeading}>
        <span>Сохранённые расчёты</span>
        <strong>{presets.length}</strong>
      </div>
      {presets.length === 0 ? (
        <div className={styles.presetsEmpty}>
          <CiCircleList aria-hidden="true" />
          <strong>Здесь пока пусто</strong>
        </div>
      ) : (
        <div className={styles.presetsList}>
          {presets.map((preset) => {
            const yields = calculatePresetYields(preset.fields);
            const meta = yields
              ? `${percentFormatter.format(yields.annualYield)}% | ${percentFormatter.format(yields.annualYieldWithPrice)}%`
              : 'Доходность недоступна';
            return (
              <div className={styles.presetRow} key={preset.id}>
                <button type="button" className={styles.presetLoad} aria-label={`Загрузить расчёт «${preset.name}»`} onClick={() => onRestore(preset)}>
                  <span>{preset.name}</span><small>{meta}</small>
                </button>
                <button type="button" className={styles.presetDelete} aria-label={`Удалить расчёт «${preset.name}»`} title={`Удалить «${preset.name}»`} onClick={() => onDelete(preset)}>
                  <FiTrash2 aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Dropdown>
  );
}
