import { useEffect, useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { useBondNameAvailability, useCreatePortfolioBond } from '#entities/bondPortfolio';
import { ApiError } from '#shared/api';
import { parseFormattedNumber } from '#shared/lib/number';
import { Button, ControlledNumberField, TextField } from '#shared/ui';

import { canonicalDecimal, todayInputValue, validateMoney, validateQuantity } from '../../utils';
import styles from './PortfolioForms.module.scss';

interface CreateBondFormValues {
  name: string;
  couponAmount: string;
  nominal: string;
  paymentsPerYear: string;
  couponPeriodDays: string;
  placementDate: string;
  maturityDate: string;
  amountSpent: string;
  quantity: string;
  purchaseDate: string;
}

interface CreateBondFormProps {
  userId: string;
  onSuccess: () => void;
  onBusyChange: (busy: boolean) => void;
}

const PAYMENTS_PER_YEAR = ['1', '2', '3', '4', '6', '12'];
const COUPON_PERIOD_BY_FREQUENCY: Record<string, string> = {
  '1': '365', '2': '182', '3': '122', '4': '91', '6': '61', '12': '30',
};
const FIELD_MAP: Record<string, keyof CreateBondFormValues> = {
  name: 'name', coupon_amount: 'couponAmount', nominal: 'nominal', payments_per_year: 'paymentsPerYear',
  coupon_period_days: 'couponPeriodDays',
  placement_date: 'placementDate', maturity_date: 'maturityDate', amount_spent: 'amountSpent',
  quantity: 'quantity', purchase_date: 'purchaseDate',
};

export function CreateBondForm({ userId, onSuccess, onBusyChange }: CreateBondFormProps) {
  const today = todayInputValue();
  const paymentFrequencyErrorId = `${useId()}-payment-frequency-error`;
  const [debouncedName, setDebouncedName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useCreatePortfolioBond(userId);
  const {
    control, register, handleSubmit, setError, getValues, setValue,
    formState: { errors, isValid, isSubmitting, dirtyFields },
  } = useForm<CreateBondFormValues>({
    mode: 'onChange',
    defaultValues: {
      name: '', couponAmount: '', nominal: '', paymentsPerYear: '', couponPeriodDays: '', placementDate: '', maturityDate: '',
      amountSpent: '', quantity: '', purchaseDate: today,
    },
  });
  const name = useWatch({ control, name: 'name' });
  const paymentsPerYear = useWatch({ control, name: 'paymentsPerYear' });
  const trimmedName = name.trim();
  const locallyValidName = trimmedName.length >= 1 && trimmedName.length <= 120;

  useEffect(() => {
    if (!locallyValidName) return undefined;
    const timeout = window.setTimeout(() => setDebouncedName(trimmedName), 350);
    return () => window.clearTimeout(timeout);
  }, [locallyValidName, trimmedName]);

  useEffect(() => {
    if (dirtyFields.couponPeriodDays) return;
    const couponPeriodDays = COUPON_PERIOD_BY_FREQUENCY[paymentsPerYear];
    if (couponPeriodDays) {
      setValue('couponPeriodDays', couponPeriodDays, { shouldValidate: true, shouldDirty: false });
    }
  }, [dirtyFields.couponPeriodDays, paymentsPerYear, setValue]);

  const availability = useBondNameAvailability(
    userId,
    debouncedName,
    locallyValidName && debouncedName === trimmedName,
  );
  let nameStatus: 'idle' | 'checking' | 'available' | 'duplicate' | 'error' = 'idle';
  if (locallyValidName) {
    if (debouncedName !== trimmedName || availability.isFetching) nameStatus = 'checking';
    else if (availability.isError) nameStatus = 'error';
    else if (availability.data === true) nameStatus = 'available';
    else if (availability.data === false) nameStatus = 'duplicate';
    else nameStatus = 'checking';
  }
  const checkingName = nameStatus === 'checking';
  const nameAvailable = nameStatus === 'available';
  const busy = isSubmitting || mutation.isPending;

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await mutation.mutateAsync({
        name: values.name.trim(),
        couponAmount: canonicalDecimal(values.couponAmount),
        nominal: canonicalDecimal(values.nominal),
        paymentsPerYear: Number(values.paymentsPerYear),
        couponPeriodDays: values.couponPeriodDays.trim() === ''
          ? undefined
          : parseFormattedNumber(values.couponPeriodDays),
        placementDate: values.placementDate,
        maturityDate: values.maturityDate,
        amountSpent: canonicalDecimal(values.amountSpent),
        quantity: parseFormattedNumber(values.quantity),
        purchaseDate: values.purchaseDate,
      });
      onSuccess();
    } catch (error) {
      if (error instanceof ApiError) {
        Object.entries(error.fieldErrors ?? {}).forEach(([field, message]) => {
          const mappedField = FIELD_MAP[field];
          if (mappedField) setError(mappedField, { type: 'server', message });
        });
        if (error.code === 'bond_name_taken' && !error.fieldErrors?.name) {
          setError('name', { type: 'server', message: 'Облигация с таким названием уже существует' });
        }
        if (!error.fieldErrors && error.code !== 'bond_name_taken') setSubmitError(error.message);
      } else {
        setSubmitError('Не удалось сохранить облигацию. Проверьте подключение и попробуйте снова.');
      }
    }
  });

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <div className={styles.grid}>
        <div className={styles.wideField}>
          <TextField
            label="Название"
            placeholder="Например, ОФЗ 26238"
            autoComplete="off"
            error={errors.name?.message}
            {...register('name', {
              validate: (value) => {
                const trimmed = value.trim();
                if (!trimmed) return 'Введите название';
                return trimmed.length <= 120 || 'Не больше 120 символов';
              },
            })}
          />
          {locallyValidName ? (
            <div className={styles.availability} aria-live="polite">
              {nameStatus === 'checking' ? <span>Проверяем…</span> : null}
              {nameStatus === 'available' ? <span className={styles.success}>Имя свободно</span> : null}
              {nameStatus === 'duplicate' ? <span className={styles.inlineError}>Облигация с таким названием уже есть</span> : null}
              {nameStatus === 'error' ? (
                <span className={styles.inlineError}>
                  Не удалось проверить имя. <button type="button" onClick={() => void availability.refetch()}>Повторить проверку</button>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <ControlledNumberField
          control={control}
          name="nominal"
          label="Номинал облигации"
          aria-label="Номинал облигации"
          unit="₽"
          inputMode="decimal"
          error={errors.nominal?.message}
          rules={{ validate: (value) => validateMoney(value, { allowZero: false, label: 'Номинал облигации' }) }}
        />
        <ControlledNumberField
          control={control}
          name="couponAmount"
          label="Величина купона"
          aria-label="Величина купона"
          unit="₽"
          inputMode="decimal"
          error={errors.couponAmount?.message}
          rules={{ validate: (value) => validateMoney(value, { allowZero: true, label: 'Купон' }) }}
        />
        <label className={styles.selectField}>
          <span>Количество выплат в год</span>
          <select
            aria-invalid={Boolean(errors.paymentsPerYear) || undefined}
            aria-describedby={errors.paymentsPerYear ? paymentFrequencyErrorId : undefined}
            {...register('paymentsPerYear', { required: 'Выберите частоту выплат' })}
          >
            <option value="">Выберите</option>
            {PAYMENTS_PER_YEAR.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          {errors.paymentsPerYear ? <small id={paymentFrequencyErrorId} role="alert">{errors.paymentsPerYear.message}</small> : null}
        </label>
        <ControlledNumberField
          control={control}
          name="couponPeriodDays"
          label="Купонный период, дней"
          aria-label="Купонный период, дней"
          inputMode="numeric"
          error={errors.couponPeriodDays?.message}
          rules={{
            validate: (value) => {
              const compact = value.replace(/[\s\u00a0\u202f]/g, '');
              if (!compact) return true;
              const parsed = parseFormattedNumber(value);
              return /^\d+$/.test(compact) && Number.isInteger(parsed) && parsed >= 1 && parsed <= 366
                || 'Введите целое число от 1 до 366';
            },
          }}
        />
        <TextField
          type="date"
          label="Дата размещения"
          max={today}
          error={errors.placementDate?.message}
          {...register('placementDate', {
            required: 'Укажите дату размещения',
            validate: (value) => {
              if (value > today) return 'Дата размещения не может быть в будущем';
              const purchase = getValues('purchaseDate');
              if (purchase && value > purchase) return 'Дата размещения должна быть не позже даты покупки';
              const maturity = getValues('maturityDate');
              return !maturity || value < maturity || 'Дата размещения должна быть раньше погашения';
            },
            deps: ['purchaseDate', 'maturityDate'],
          })}
        />
        <TextField
          type="date"
          label="Дата погашения"
          min={today}
          error={errors.maturityDate?.message}
          {...register('maturityDate', {
            required: 'Укажите дату погашения',
            validate: (value) => {
              if (value <= today) return 'Дата погашения должна быть позже сегодняшней';
              const placement = getValues('placementDate');
              return !placement || value > placement || 'Дата погашения должна быть позже размещения';
            },
            deps: ['placementDate', 'purchaseDate'],
          })}
        />
        <ControlledNumberField
          control={control}
          name="amountSpent"
          label="Сумма покупки"
          aria-label="Сумма покупки"
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
          className={styles.wideField}
          max={today}
          error={errors.purchaseDate?.message}
          {...register('purchaseDate', {
            required: 'Укажите дату покупки',
            validate: (value) => {
              if (value > today) return 'Дата покупки не может быть в будущем';
              const placement = getValues('placementDate');
              if (placement && value < placement) return 'Дата покупки должна быть не раньше размещения';
              const maturity = getValues('maturityDate');
              return !maturity || value < maturity || 'Дата покупки должна быть раньше погашения';
            },
            deps: ['placementDate', 'maturityDate'],
          })}
        />
      </div>
      {submitError ? <p className={styles.formError} role="alert">{submitError} Проверьте данные и повторите попытку.</p> : null}
      <div className={styles.submitRow}>
        <Button className={styles.submitButton} type="submit" disabled={!isValid || !nameAvailable || checkingName || busy}>
          {busy ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
}
