import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useBondNameAvailability, useCreatePortfolioBond, useTInvestBondLookup, useTInvestBondSearch } from '#entities/bondPortfolio';
import type { TInvestBondSearchItem } from '#entities/bondPortfolio';
import { ApiError } from '#shared/api';
import { parseFormattedNumber } from '#shared/lib/number';

import { canonicalDecimal, todayInputValue } from '../../utils';
import styles from './PortfolioForms.module.scss';
import { SelectedBondPreview } from './SelectedBondPreview';
import { BondSearchField, PurchaseFields, SubmitRow } from './components';
import type { PurchaseFormValues } from './types';

interface CreateBondFormProps {
  userId: string;
  onSuccess: () => void;
  onBusyChange: (busy: boolean) => void;
}

const FIELD_MAP: Record<string, keyof PurchaseFormValues> = {
  amount_spent: 'amountSpent', quantity: 'quantity', purchase_date: 'purchaseDate',
};

export function CreateBondForm({ userId, onSuccess, onBusyChange }: CreateBondFormProps) {
  const today = todayInputValue();
  const formId = useId();
  const purchaseHeadingId = `${formId}-purchase-heading`;
  const [searchText, setSearchText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedInstrumentUid, setSelectedInstrumentUid] = useState<string | null>(null);
  const [selectedBondError, setSelectedBondError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useCreatePortfolioBond(userId);
  const {
    control, register, handleSubmit, reset, setError,
    formState: { errors, isValid, isSubmitting },
  } = useForm<PurchaseFormValues>({
    mode: 'onChange',
    defaultValues: { amountSpent: '', quantity: '', purchaseDate: today },
  });
  const normalizedQuery = searchText.trim();

  useEffect(() => {
    if (normalizedQuery.length < 2) return undefined;
    const timeout = window.setTimeout(() => setDebouncedQuery(normalizedQuery), 350);
    return () => window.clearTimeout(timeout);
  }, [normalizedQuery]);

  const search = useTInvestBondSearch(
    userId,
    debouncedQuery,
    Boolean(debouncedQuery) && !selectedInstrumentUid,
  );
  const searchMatchesQuery = normalizedQuery.length >= 2 && debouncedQuery === normalizedQuery;
  const searchPending = normalizedQuery.length >= 2 && (
    !searchMatchesQuery || search.isFetching || search.isPending
  );
  const searchError = searchMatchesQuery && search.isError;
  const searchItems = searchMatchesQuery ? search.data : undefined;

  const lookup = useTInvestBondLookup(
    userId,
    selectedInstrumentUid ?? '',
    Boolean(selectedInstrumentUid),
  );
  const selectedBond = lookup.data ?? null;
  const lookupPending = Boolean(selectedInstrumentUid) && (lookup.isFetching || lookup.isPending);
  const lookupMissing = Boolean(selectedInstrumentUid) && !lookupPending && !lookup.isError && lookup.data === null;
  let lookupErrorMessage: string | null = null;
  let lookupRetryable = false;
  if (lookup.isError) {
    if (lookup.error instanceof ApiError && lookup.error.code === 't_invest_bond_matured') {
      lookupErrorMessage = 'Облигация уже погашена и не может быть добавлена.';
    } else if (lookup.error instanceof ApiError && lookup.error.code === 't_invest_bond_not_placed') {
      lookupErrorMessage = 'Облигация ещё не размещена и не может быть добавлена.';
    } else {
      lookupErrorMessage = 'Не удалось загрузить данные облигации.';
      lookupRetryable = true;
    }
  } else if (lookupMissing) {
    lookupErrorMessage = 'Облигация больше недоступна.';
  }

  const availability = useBondNameAvailability(
    userId,
    selectedBond?.name ?? '',
    Boolean(selectedBond),
  );
  let availabilityStatus: 'checking' | 'available' | 'duplicate' | 'error' = 'checking';
  if (selectedBondError) availabilityStatus = 'duplicate';
  else if (availability.isError) availabilityStatus = 'error';
  else if (availability.isFetching || availability.isPending) availabilityStatus = 'checking';
  else if (availability.data === true) availabilityStatus = 'available';
  else if (availability.data === false) availabilityStatus = 'duplicate';

  const selectionIsCurrent = Boolean(selectedBond) && (
    selectedBond?.ticker.localeCompare(normalizedQuery, 'ru-RU', { sensitivity: 'accent' }) === 0
  );
  const nameAvailable = availabilityStatus === 'available' && !selectedBondError;
  const busy = isSubmitting || mutation.isPending;

  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  const resetPurchase = () => reset({ amountSpent: '', quantity: '', purchaseDate: today });

  const selectBond = (bond: TInvestBondSearchItem) => {
    setSelectedInstrumentUid(bond.instrumentUid);
    setSearchText(bond.ticker);
    setSelectedBondError(null);
    setSubmitError(null);
    resetPurchase();
  };

  const changeSearch = (value: string) => {
    const nextQuery = value.trim();
    setSearchText(value);
    setSubmitError(null);
    if (nextQuery.length < 2) setDebouncedQuery('');
    if (selectedInstrumentUid) {
      setSelectedInstrumentUid(null);
      setSelectedBondError(null);
      resetPurchase();
    }
  };

  const submit = handleSubmit(async (values) => {
    if (!selectionIsCurrent || !selectedBond || !nameAvailable) return;
    setSubmitError(null);
    setSelectedBondError(null);
    try {
      await mutation.mutateAsync({
        instrumentUid: selectedBond.instrumentUid,
        ticker: selectedBond.ticker,
        name: selectedBond.name,
        nominal: selectedBond.nominal,
        paymentsPerYear: selectedBond.paymentsPerYear,
        placementDate: selectedBond.placementDate,
        maturityDate: selectedBond.maturityDate,
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
        const nameError = error.fieldErrors?.name;
        if (nameError) setSelectedBondError(nameError);
        else if (error.code === 'bond_name_taken') {
          setSelectedBondError('Облигация с таким названием уже существует');
        }
        setSubmitError(error.message);
      } else {
        setSubmitError('Не удалось сохранить облигацию. Проверьте подключение и попробуйте снова.');
      }
    }
  });

  return (
    <form
      className={`${styles.form} ${styles.createForm}`}
      noValidate
      onSubmit={submit}
    >
      <BondSearchField
        value={searchText}
        selected={Boolean(selectedInstrumentUid)}
        items={searchItems}
        pending={searchPending}
        error={searchError}
        onChange={changeSearch}
        onSelect={selectBond}
        onRetry={() => void search.refetch()}
      />

      {lookupPending ? <p className={styles.lookupStatus} aria-live="polite">Загружаем данные облигации…</p> : null}
      {lookupErrorMessage ? (
        <p className={styles.inlineError} role="alert">
          {lookupErrorMessage}{' '}
          {lookupRetryable ? <button type="button" onClick={() => void lookup.refetch()}>Повторить загрузку</button> : null}
        </p>
      ) : null}

      {selectedBond ? (
        <>
          <SelectedBondPreview
            bond={selectedBond}
            status={availabilityStatus}
            statusMessage={selectedBondError ?? undefined}
            onRetry={availabilityStatus === 'error' ? () => void availability.refetch() : undefined}
          />
          <section className={styles.purchaseSection} aria-labelledby={purchaseHeadingId}>
            <div className={styles.purchaseHeading}>
              <span aria-hidden="true" />
              <h3 id={purchaseHeadingId}>Первая покупка</h3>
            </div>
            <PurchaseFields
              control={control}
              register={register}
              errors={errors}
              minimumDate={selectedBond.placementDate}
              maximumDate={today}
              maturityDate={selectedBond.maturityDate}
              minimumDateError="Дата покупки должна быть не раньше размещения"
            />
          </section>
          {submitError ? <p className={styles.formError} role="alert">{submitError}</p> : null}
          <SubmitRow
            disabled={!isValid || !selectionIsCurrent || !nameAvailable || busy}
            busy={busy}
            busyLabel="Сохраняем…"
            idleLabel="Сохранить"
          />
        </>
      ) : null}
    </form>
  );
}
