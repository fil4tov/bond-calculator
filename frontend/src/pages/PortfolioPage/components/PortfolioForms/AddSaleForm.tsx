import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useAddPortfolioSale } from '#entities/bondPortfolio';
import type { BondPortfolioItem } from '#entities/bondPortfolio';
import { ApiError } from '#shared/api';
import { parseFormattedNumber } from '#shared/lib/number';
import { Button, ControlledNumberField, TextField } from '#shared/ui';

import { availableQuantityOnDate, canonicalDecimal, todayInputValue, validateMoney, validateQuantity } from '../../utils';
import styles from './PortfolioForms.module.scss';

interface AddSaleFormValues {
  amountReceived: string;
  quantity: string;
  saleDate: string;
}

interface AddSaleFormProps {
  userId: string;
  bond: BondPortfolioItem;
  onSuccess: () => void;
  onBusyChange: (busy: boolean) => void;
}

const FIELD_MAP: Record<string, keyof AddSaleFormValues> = {
  amount_received: 'amountReceived', quantity: 'quantity', sale_date: 'saleDate',
};

const previousDate = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

const localizedFieldError = (field: string) => {
  if (field === 'quantity') return 'Количество превышает доступный остаток на выбранную дату';
  if (field === 'sale_date') return 'Дата продажи должна быть не раньше размещения и раньше погашения';
  if (field === 'amount_received') return 'Проверьте сумму продажи';
  return null;
};

const localizedSubmitError = (code: string) => code === 'validation_error'
  ? 'Не удалось проверить данные продажи. Проверьте поля и попробуйте снова.'
  : 'Не удалось зафиксировать продажу. Проверьте подключение и попробуйте снова.';

export function AddSaleForm({ userId, bond, onSuccess, onBusyChange }: AddSaleFormProps) {
  const today = todayInputValue();
  const saleDateMax = today < bond.maturityDate ? today : previousDate(bond.maturityDate);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useAddPortfolioSale(userId);
  const {
    control, register, handleSubmit, setError, watch, getValues, trigger,
    formState: { errors, isValid, isSubmitting },
  } = useForm<AddSaleFormValues>({
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
    <form className={styles.form} noValidate onSubmit={submit}>
      <p className={styles.availability} aria-live="polite">Доступно на выбранную дату: {availableQuantity.toLocaleString('ru-RU')} шт.</p>
      <div className={styles.grid}>
        <ControlledNumberField
          control={control}
          name="amountReceived"
          label="Сумма сделки (с учётом НКД и комиссий)"
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
          min={bond.placementDate}
          max={saleDateMax}
          wide
          error={errors.saleDate?.message}
          {...register('saleDate', {
            required: 'Укажите дату продажи',
            validate: (value) => {
              if (value > today) return 'Дата продажи не может быть в будущем';
              if (value < bond.placementDate) return 'Дата продажи должна быть не раньше размещения';
              return value < bond.maturityDate || 'Дата продажи должна быть раньше погашения';
            },
          })}
        />
      </div>
      {submitError ? <p className={styles.formError} role="alert">{submitError} Повторите попытку.</p> : null}
      <div className={styles.submitRow}>
        <p>Итог сделки будет рассчитан по фактическим операциям в реестре.</p>
        <Button className={styles.submitButton} type="submit" disabled={!isValid || busy || availableQuantity <= 0}>
          {busy ? 'Фиксируем…' : 'Зафиксировать'}
        </Button>
      </div>
    </form>
  );
}
