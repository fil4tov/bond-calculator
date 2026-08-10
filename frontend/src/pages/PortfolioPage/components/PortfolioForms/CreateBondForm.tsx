import { useEffect, useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { useBondNameAvailability, useCreatePortfolioBond, useTInvestBondLookup } from '#entities/bondPortfolio';
import type { TInvestBondLookup } from '#entities/bondPortfolio';
import { ApiError } from '#shared/api';
import { parseFormattedNumber } from '#shared/lib/number';
import { Button, ControlledNumberField, TextField } from '#shared/ui';

import { canonicalDecimal, todayInputValue, validateMoney, validateQuantity } from '../../utils';
import styles from './PortfolioForms.module.scss';

interface CreateBondFormValues {
  ticker: string;
  instrumentUid: string;
  name: string;
  nominal: string;
  paymentsPerYear: string;
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

const FIELD_MAP: Record<string, keyof CreateBondFormValues> = {
  instrument_uid: 'instrumentUid', ticker: 'ticker', name: 'name', nominal: 'nominal', payments_per_year: 'paymentsPerYear',
  placement_date: 'placementDate', maturity_date: 'maturityDate', amount_spent: 'amountSpent', quantity: 'quantity', purchase_date: 'purchaseDate',
};

const normalizeTicker = (value: string) => value.trim().toUpperCase();

function validatePaymentsPerYear(value: string) {
  const compact = value.replace(/[\s\u00a0\u202f]/g, '');
  if (!compact) return 'Введите количество выплат в год';
  const parsed = parseFormattedNumber(value);
  return /^\d+$/.test(compact) && Number.isInteger(parsed) && parsed >= 0
    || 'Введите целое неотрицательное число';
}

export function CreateBondForm({ userId, onSuccess, onBusyChange }: CreateBondFormProps) {
  const today = todayInputValue();
  const listboxId = `${useId()}-ticker-options`;
  const [debouncedTicker, setDebouncedTicker] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [selectedBond, setSelectedBond] = useState<TInvestBondLookup | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [optionActive, setOptionActive] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useCreatePortfolioBond(userId);
  const {
    control, register, handleSubmit, setError, getValues, setValue,
    formState: { errors, isValid, isSubmitting },
  } = useForm<CreateBondFormValues>({
    mode: 'onChange',
    defaultValues: {
      ticker: '', instrumentUid: '', name: '', nominal: '', paymentsPerYear: '', placementDate: '', maturityDate: '',
      amountSpent: '', quantity: '', purchaseDate: today,
    },
  });
  const ticker = useWatch({ control, name: 'ticker' });
  const name = useWatch({ control, name: 'name' });
  const normalizedTicker = normalizeTicker(ticker);
  const trimmedName = name.trim();
  const locallyValidName = trimmedName.length >= 1 && trimmedName.length <= 120;

  useEffect(() => {
    if (!normalizedTicker) return undefined;
    const timeout = window.setTimeout(() => setDebouncedTicker(normalizedTicker), 350);
    return () => window.clearTimeout(timeout);
  }, [normalizedTicker]);

  useEffect(() => {
    if (!locallyValidName) return undefined;
    const timeout = window.setTimeout(() => setDebouncedName(trimmedName), 350);
    return () => window.clearTimeout(timeout);
  }, [locallyValidName, trimmedName]);

  const lookup = useTInvestBondLookup(userId, debouncedTicker, Boolean(debouncedTicker));
  const lookupMatchesTicker = Boolean(normalizedTicker) && debouncedTicker === normalizedTicker;
  const lookupSearching = Boolean(normalizedTicker) && (
    !lookupMatchesTicker || lookup.isFetching || lookup.isPending
  );
  const lookupError = lookupMatchesTicker && lookup.isError;
  const lookupItem = lookupMatchesTicker ? lookup.data : undefined;
  const showLookup = dropdownOpen && Boolean(normalizedTicker) && !selectedBond;

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
  const selectionIsCurrent = selectedBond?.ticker === normalizedTicker && getValues('instrumentUid') === selectedBond.instrumentUid;
  const busy = isSubmitting || mutation.isPending;

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  const selectBond = (bond: TInvestBondLookup) => {
    setSelectedBond(bond);
    setDropdownOpen(false);
    setOptionActive(false);
    setValue('ticker', bond.ticker, { shouldValidate: true, shouldDirty: true });
    setValue('instrumentUid', bond.instrumentUid, { shouldValidate: true, shouldDirty: true });
    setValue('name', bond.name, { shouldValidate: true, shouldDirty: true });
    setValue('nominal', bond.nominal, { shouldValidate: true, shouldDirty: true });
    setValue('paymentsPerYear', String(bond.paymentsPerYear), { shouldValidate: true, shouldDirty: true });
    setValue('placementDate', bond.placementDate, { shouldValidate: true, shouldDirty: true });
    setValue('maturityDate', bond.maturityDate, { shouldValidate: true, shouldDirty: true });
  };

  const submit = handleSubmit(async (values) => {
    if (!selectionIsCurrent || !selectedBond) return;
    setSubmitError(null);
    try {
      await mutation.mutateAsync({
        instrumentUid: values.instrumentUid,
        ticker: selectedBond.ticker,
        name: values.name.trim(),
        nominal: canonicalDecimal(values.nominal),
        paymentsPerYear: parseFormattedNumber(values.paymentsPerYear),
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
        setSubmitError(error.message);
      } else {
        setSubmitError('Не удалось сохранить облигацию. Проверьте подключение и попробуйте снова.');
      }
    }
  });

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <input type="hidden" {...register('instrumentUid')} />
      <div className={styles.grid}>
        <div className={`${styles.wideField} ${styles.tickerField}`}>
          <TextField
            label="Тикер"
            placeholder="Например, SU26238"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showLookup}
            aria-controls={showLookup ? listboxId : undefined}
            aria-activedescendant={showLookup && lookupItem && optionActive ? `${listboxId}-option` : undefined}
            error={errors.ticker?.message}
            {...register('ticker', { onChange: (event) => {
              const nextTicker = normalizeTicker(event.target.value);
              setDropdownOpen(Boolean(nextTicker));
              setOptionActive(false);
              if (!nextTicker) setDebouncedTicker('');
              if (selectedBond && event.target.value !== selectedBond.ticker) {
                setSelectedBond(null);
                setValue('instrumentUid', '', { shouldValidate: true });
              }
            } })}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && lookupItem) { event.preventDefault(); setDropdownOpen(true); setOptionActive(true); }
              if (event.key === 'Enter' && optionActive && lookupItem) { event.preventDefault(); selectBond(lookupItem); }
              if (event.key === 'Escape') { setDropdownOpen(false); setOptionActive(false); }
            }}
          />
          {showLookup ? (
            <div id={listboxId} className={styles.lookupMenu} role="listbox" aria-label="Результаты поиска тикера">
              {lookupSearching ? <p aria-live="polite">Ищем облигацию…</p> : null}
              {!lookupSearching && lookupItem ? (
                <button
                  id={`${listboxId}-option`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={optionActive}
                  className={styles.lookupOption}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectBond(lookupItem)}
                >
                  <strong>{lookupItem.ticker}</strong><span>{lookupItem.name}</span>
                </button>
              ) : null}
              {!lookupSearching && lookupItem === null ? <p>Облигация не найдена</p> : null}
              {lookupError ? (
                <p className={styles.inlineError} role="alert">
                  {lookup.error instanceof Error ? lookup.error.message : 'Не удалось найти облигацию.'}{' '}
                  <button type="button" onClick={() => void lookup.refetch()}>Повторить поиск</button>
                </p>
              ) : null}
            </div>
          ) : null}
          {selectedBond ? <p className={styles.selectedBond}>Выбрана: <strong>{selectedBond.ticker} — {selectedBond.name}</strong></p> : null}
        </div>
        <div className={styles.wideField}>
          <TextField
            label="Название"
            placeholder="Например, ОФЗ 26238"
            autoComplete="off"
            error={errors.name?.message}
            {...register('name', {
              onChange: (event) => { if (!event.target.value.trim()) setDebouncedName(''); },
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
              {nameStatus === 'error' ? <span className={styles.inlineError}>Не удалось проверить имя. <button type="button" onClick={() => void availability.refetch()}>Повторить проверку</button></span> : null}
            </div>
          ) : null}
        </div>
        <ControlledNumberField control={control} name="nominal" label="Номинал облигации" aria-label="Номинал облигации" unit="₽" inputMode="decimal" error={errors.nominal?.message} rules={{ validate: (value) => validateMoney(value, { allowZero: false, label: 'Номинал облигации' }) }} />
        <ControlledNumberField control={control} name="paymentsPerYear" label="Количество выплат в год" aria-label="Количество выплат в год" inputMode="numeric" integer error={errors.paymentsPerYear?.message} rules={{ validate: validatePaymentsPerYear }} />
        <TextField type="date" label="Дата размещения" max={today} error={errors.placementDate?.message} {...register('placementDate', { required: 'Укажите дату размещения', validate: (value) => {
          if (value > today) return 'Дата размещения не может быть в будущем';
          const purchase = getValues('purchaseDate'); if (purchase && value > purchase) return 'Дата размещения должна быть не позднее даты покупки';
          const maturity = getValues('maturityDate'); return !maturity || value < maturity || 'Дата размещения должна быть раньше погашения';
        }, deps: ['purchaseDate', 'maturityDate'] })} />
        <TextField type="date" label="Дата погашения" min={today} error={errors.maturityDate?.message} {...register('maturityDate', { required: 'Укажите дату погашения', validate: (value) => {
          if (value <= today) return 'Дата погашения должна быть позже сегодняшней';
          const placement = getValues('placementDate'); return !placement || value > placement || 'Дата погашения должна быть позже размещения';
        }, deps: ['placementDate', 'purchaseDate'] })} />
        <ControlledNumberField control={control} name="amountSpent" label="Сумма покупки" aria-label="Сумма покупки" unit="₽" inputMode="decimal" error={errors.amountSpent?.message} rules={{ validate: (value) => validateMoney(value, { allowZero: false, label: 'Сумма покупки' }) }} />
        <ControlledNumberField control={control} name="quantity" label="Количество" inputMode="numeric" integer error={errors.quantity?.message} rules={{ validate: validateQuantity }} />
        <TextField type="date" label="Дата покупки" className={styles.wideField} max={today} error={errors.purchaseDate?.message} {...register('purchaseDate', { required: 'Укажите дату покупки', validate: (value) => {
          if (value > today) return 'Дата покупки не может быть в будущем';
          const placement = getValues('placementDate'); if (placement && value < placement) return 'Дата покупки должна быть не раньше размещения';
          const maturity = getValues('maturityDate'); return !maturity || value < maturity || 'Дата покупки должна быть раньше погашения';
        }, deps: ['placementDate', 'maturityDate'] })} />
      </div>
      {submitError ? <p className={styles.formError} role="alert">{submitError}</p> : null}
      <div className={styles.submitRow}>
        <Button className={styles.submitButton} type="submit" disabled={!isValid || !selectionIsCurrent || !nameAvailable || checkingName || busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</Button>
      </div>
    </form>
  );
}
