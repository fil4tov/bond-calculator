import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';

import { parseFormattedNumber } from '#shared/lib/number';
import { ControlledNumberField, TextField } from '#shared/ui';

import { validateMoney, validateQuantity } from '../../../../utils';
import styles from '../../PortfolioForms.module.scss';
import type { SaleFormValues } from '../../types';

interface SaleFieldsProps {
  control: Control<SaleFormValues>;
  register: UseFormRegister<SaleFormValues>;
  errors: FieldErrors<SaleFormValues>;
  availableQuantity: number;
  placementDate: string;
  maturityDate: string;
  maximumDate: string;
  today: string;
}

export function SaleFields({
  control,
  register,
  errors,
  availableQuantity,
  placementDate,
  maturityDate,
  maximumDate,
  today,
}: SaleFieldsProps) {
  return (
    <>
      <p className={styles.availability} aria-live="polite">
        Доступно на выбранную дату: {availableQuantity.toLocaleString('ru-RU')} шт.
      </p>
      <div className={styles.grid}>
        <ControlledNumberField
          control={control}
          name="amountReceived"
          label="Сумма сделки"
          hint="(с учётом НКД и комиссий)"
          aria-label="Сумма сделки (с учётом НКД и комиссий)"
          unit="₽"
          inputMode="decimal"
          error={errors.amountReceived?.message}
          rules={{ validate: (value) => validateMoney(value, { allowZero: false, label: 'Сумма продажи' }) }}
        />
        <ControlledNumberField
          control={control}
          name="quantity"
          label="Количество"
          inputMode="numeric"
          integer
          error={errors.quantity?.message}
          rules={{ validate: (value) => {
            const baseError = validateQuantity(value);
            if (baseError !== true) return baseError;
            return parseFormattedNumber(value) <= availableQuantity || `Доступно не более ${availableQuantity.toLocaleString('ru-RU')} шт.`;
          } }}
        />
        <TextField
          type="date"
          label="Дата продажи"
          min={placementDate}
          max={maximumDate}
          wide
          error={errors.saleDate?.message}
          {...register('saleDate', {
            required: 'Укажите дату продажи',
            validate: (value) => {
              if (value > today) return 'Дата продажи не может быть в будущем';
              if (value < placementDate) return 'Дата продажи должна быть не раньше размещения';
              return value < maturityDate || 'Дата продажи должна быть раньше погашения';
            },
          })}
        />
      </div>
    </>
  );
}
