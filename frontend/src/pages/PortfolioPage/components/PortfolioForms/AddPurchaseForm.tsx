import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useAddPortfolioPurchase } from '#entities/bondPortfolio';
import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { ApiError } from '#shared/api';
import { parseFormattedNumber } from '#shared/lib/number';
import { Button, ControlledNumberField, TextField } from '#shared/ui';

import { canonicalDecimal, todayInputValue, validateMoney, validateQuantity } from '../../utils';
import styles from './PortfolioForms.module.scss';

interface AddPurchaseFormValues {
  amountSpent: string;
  quantity: string;
  purchaseDate: string;
}

interface AddPurchaseFormProps {
  userId: string;
  bond: BondPortfolioItem;
  onSuccess: () => void;
  onBusyChange: (busy: boolean) => void;
}

const FIELD_MAP: Record<string, keyof AddPurchaseFormValues> = {
  amount_spent: 'amountSpent', quantity: 'quantity', purchase_date: 'purchaseDate',
};

export function AddPurchaseForm({ userId, bond, onSuccess, onBusyChange }: AddPurchaseFormProps) {
  const today = todayInputValue();
  const earliestPurchaseDate = bond.operations.reduce<string | null>((earliest, operation) => {
    if (operation.operationType !== 'purchase') return earliest;
    return earliest === null || operation.operationDate < earliest ? operation.operationDate : earliest;
  }, null) ?? bond.placementDate;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useAddPortfolioPurchase(userId);
  const {
    control, register, handleSubmit, setError,
    formState: { errors, isValid, isSubmitting },
  } = useForm<AddPurchaseFormValues>({
    mode: 'onChange',
    defaultValues: { amountSpent: '', quantity: '', purchaseDate: today },
  });
  const busy = isSubmitting || mutation.isPending;

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await mutation.mutateAsync({
        bondId: bond.id,
        input: {
          amountSpent: canonicalDecimal(values.amountSpent),
          quantity: parseFormattedNumber(values.quantity),
          purchaseDate: values.purchaseDate,
        },
      });
      onSuccess();
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors ?? {}).forEach(([field, message]) => {
          const mappedField = FIELD_MAP[field];
          if (mappedField) setError(mappedField, { type: 'server', message });
        });
        if (!error.fieldErrors) setSubmitError(error.message);
      } else {
        setSubmitError('Не удалось добавить покупку. Проверьте подключение и попробуйте снова.');
      }
    }
  });

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <div className={styles.grid}>
        <ControlledNumberField
          control={control}
          name="amountSpent"
          label="Сумма сделки (с учётом НКД и комиссий)"
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
          min={earliestPurchaseDate}
          max={today}
          wide
          error={errors.purchaseDate?.message}
          {...register('purchaseDate', {
            required: 'Укажите дату покупки',
            validate: (value) => {
              if (value > today) return 'Дата покупки не может быть в будущем';
              if (value < earliestPurchaseDate) return 'Дата покупки должна быть не раньше первой покупки';
              return value < bond.maturityDate || 'Дата покупки должна быть раньше погашения';
            },
          })}
        />
      </div>
      {submitError ? <p className={styles.formError} role="alert">{submitError} Повторите попытку.</p> : null}
      <div className={styles.submitRow}>
        <p>
          После добавления покупки пересчитается купонная доходность за {bond.couponYieldYear} год
        </p>
        <Button className={styles.submitButton} type="submit" disabled={!isValid || busy}>
          {busy ? 'Фиксируем…' : 'Зафиксировать'}
        </Button>
      </div>
    </form>
  );
}
