import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useAddPortfolioSale } from '#entities/bondPortfolio';
import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { ApiError } from '#shared/api';
import { parseFormattedNumber } from '#shared/lib/number';

import { availableQuantityOnDate, canonicalDecimal, todayInputValue } from '../../utils';
import styles from './PortfolioForms.module.scss';
import { SaleFields, SubmitRow } from './components';
import type { SaleFormValues } from './types';
import { localizedFieldError, localizedSubmitError, previousDate } from './utils';

interface AddSaleFormProps {
  userId: string;
  bond: BondPortfolioItem;
  onSuccess: () => void;
  onBusyChange: (busy: boolean) => void;
}

const FIELD_MAP: Record<string, keyof SaleFormValues> = {
  amount_received: 'amountReceived', quantity: 'quantity', sale_date: 'saleDate',
};

export function AddSaleForm({ userId, bond, onSuccess, onBusyChange }: AddSaleFormProps) {
  const today = todayInputValue();
  const saleDateMax = today < bond.maturityDate ? today : previousDate(bond.maturityDate);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useAddPortfolioSale(userId);
  const {
    control, register, handleSubmit, setError, watch, getValues, trigger,
    formState: { errors, isValid, isSubmitting },
  } = useForm<SaleFormValues>({
    mode: 'onChange',
    defaultValues: { amountReceived: '', quantity: '', saleDate: saleDateMax },
  });
  const saleDate = watch('saleDate');
  const availableQuantity = availableQuantityOnDate(bond.operations, saleDate || saleDateMax);
  const busy = isSubmitting || mutation.isPending;

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  useEffect(() => {
    if (getValues('quantity')) void trigger('quantity');
  }, [getValues, saleDate, trigger]);

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await mutation.mutateAsync({
        bondId: bond.id,
        input: {
          amountReceived: canonicalDecimal(values.amountReceived),
          quantity: parseFormattedNumber(values.quantity),
          saleDate: values.saleDate,
        },
      });
      onSuccess();
    } catch (error) {
      if (error instanceof ApiError) {
        let mappedAnyField = false;
        Object.keys(error.fieldErrors ?? {}).forEach((field) => {
          const mappedField = FIELD_MAP[field];
          const localizedMessage = localizedFieldError(field);
          if (mappedField && localizedMessage) {
            mappedAnyField = true;
            setError(mappedField, { type: 'server', message: localizedMessage });
          }
        });
        if (!mappedAnyField) setSubmitError(localizedSubmitError(error.code));
      } else {
        setSubmitError('Не удалось зафиксировать продажу. Проверьте подключение и попробуйте снова.');
      }
    }
  });

  return (
    <form className={`${styles.form} ${styles.transactionForm}`} noValidate onSubmit={submit}>
      <SaleFields
        control={control}
        register={register}
        errors={errors}
        availableQuantity={availableQuantity}
        placementDate={bond.placementDate}
        maturityDate={bond.maturityDate}
        maximumDate={saleDateMax}
        today={today}
      />
      {submitError ? <p className={styles.formError} role="alert">{submitError} Повторите попытку.</p> : null}
      <SubmitRow
        disabled={!isValid || busy || availableQuantity <= 0}
        busy={busy}
        busyLabel="Фиксируем…"
        idleLabel="Зафиксировать"
      >
        <p>Итог сделки будет рассчитан по фактическим операциям в реестре.</p>
      </SubmitRow>
    </form>
  );
}
