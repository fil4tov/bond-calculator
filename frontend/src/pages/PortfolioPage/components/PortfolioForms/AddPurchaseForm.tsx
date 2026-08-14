import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useAddPortfolioPurchase } from '#entities/bondPortfolio';
import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { ApiError } from '#shared/api';
import { parseFormattedNumber } from '#shared/lib/number';
import { canonicalDecimal, todayInputValue } from '../../utils';
import styles from './PortfolioForms.module.scss';
import { PurchaseFields, SubmitRow } from './components';
import type { PurchaseFormValues } from './types';

interface AddPurchaseFormProps {
  userId: string;
  bond: BondPortfolioItem;
  onSuccess: () => void;
  onBusyChange: (busy: boolean) => void;
}

const FIELD_MAP: Record<string, keyof PurchaseFormValues> = {
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
  } = useForm<PurchaseFormValues>({
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
    <form className={`${styles.form} ${styles.transactionForm}`} noValidate onSubmit={submit}>
      <PurchaseFields
        control={control}
        register={register}
        errors={errors}
        minimumDate={earliestPurchaseDate}
        maximumDate={today}
        maturityDate={bond.maturityDate}
        minimumDateError="Дата покупки должна быть не раньше первой покупки"
      />
      {submitError ? <p className={styles.formError} role="alert">{submitError} Повторите попытку.</p> : null}
      <SubmitRow disabled={!isValid || busy} busy={busy} busyLabel="Фиксируем…" idleLabel="Зафиксировать">
        <p>
          После добавления покупки пересчитается купонная доходность за {bond.couponYieldYear} год
        </p>
      </SubmitRow>
    </form>
  );
}
