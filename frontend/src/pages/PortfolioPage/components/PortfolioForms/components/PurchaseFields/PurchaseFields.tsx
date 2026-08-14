import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';

import { ControlledNumberField, TextField } from '#shared/ui';

import { validateMoney, validateQuantity } from '../../../../utils';
import styles from '../../PortfolioForms.module.scss';
import type { PurchaseFormValues } from '../../types';

interface PurchaseFieldsProps {
  control: Control<PurchaseFormValues>;
  register: UseFormRegister<PurchaseFormValues>;
  errors: FieldErrors<PurchaseFormValues>;
  minimumDate: string;
  maximumDate: string;
  maturityDate: string;
  minimumDateError: string;
}

export function PurchaseFields({
  control,
  register,
  errors,
  minimumDate,
  maximumDate,
  maturityDate,
  minimumDateError,
}: PurchaseFieldsProps) {
  return (
    <div className={styles.grid}>
      <ControlledNumberField
        control={control}
        name="amountSpent"
        label="Сумма сделки"
        hint="(с учётом НКД и комиссий)"
        aria-label="Сумма сделки (с учётом НКД и комиссий)"
        unit="₽"
        inputMode="decimal"
        error={errors.amountSpent?.message}
        rules={{ validate: (value) => validateMoney(value, { allowZero: false, label: 'Сумма покупки' }) }}
      />
      <ControlledNumberField
        control={control}
        name="quantity"
        label="Количество"
        inputMode="numeric"
        integer
        error={errors.quantity?.message}
        rules={{ validate: validateQuantity }}
      />
      <TextField
        type="date"
        label="Дата покупки"
        min={minimumDate}
        max={maximumDate}
        wide
        error={errors.purchaseDate?.message}
        {...register('purchaseDate', {
          required: 'Укажите дату покупки',
          validate: (value) => {
            if (value > maximumDate) return 'Дата покупки не может быть в будущем';
            if (value < minimumDate) return minimumDateError;
            return value < maturityDate || 'Дата покупки должна быть раньше погашения';
          },
        })}
      />
    </div>
  );
}
