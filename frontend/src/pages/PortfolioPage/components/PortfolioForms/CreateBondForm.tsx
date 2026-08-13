import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useBondNameAvailability, useCreatePortfolioBond, useTInvestBondLookup, useTInvestBondSearch } from '#entities/bondPortfolio';
import type { TInvestBondSearchItem } from '#entities/bondPortfolio';
import { ApiError } from '#shared/api';
import { parseFormattedNumber } from '#shared/lib/number';
import { Button, ControlledNumberField, TextField } from '#shared/ui';

import { canonicalDecimal, todayInputValue, validateMoney, validateQuantity } from '../../utils';
import styles from './PortfolioForms.module.scss';
import { SelectedBondPreview } from './SelectedBondPreview';

interface CreateBondFormValues {
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
  amount_spent: 'amountSpent', quantity: 'quantity', purchase_date: 'purchaseDate',
};
const MAX_VISIBLE_SEARCH_RESULTS = 5;

export function CreateBondForm({ userId, onSuccess, onBusyChange }: CreateBondFormProps) {
  const today = todayInputValue();
  const formId = useId();
  const listboxId = `${formId}-ticker-options`;
  const purchaseHeadingId = `${formId}-purchase-heading`;
  const [searchText, setSearchText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedInstrumentUid, setSelectedInstrumentUid] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const [selectedBondError, setSelectedBondError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useCreatePortfolioBond(userId);
  const {
    control, register, handleSubmit, reset, setError,
    formState: { errors, isValid, isSubmitting },
  } = useForm<CreateBondFormValues>({
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
  const visibleSearchItems = searchItems?.slice(0, MAX_VISIBLE_SEARCH_RESULTS);
  const showLookup = dropdownOpen && normalizedQuery.length >= 2 && !selectedInstrumentUid;

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
    setDropdownOpen(false);
    setActiveOptionIndex(-1);
    setSelectedBondError(null);
    setSubmitError(null);
    resetPurchase();
  };

  const changeSearch = (value: string) => {
    const nextQuery = value.trim();
    setSearchText(value);
    setDropdownOpen(nextQuery.length >= 2);
    setActiveOptionIndex(-1);
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
      <div className={`${styles.tickerField} ${selectedInstrumentUid ? styles.tickerFieldSelected : ''}`}>
        <TextField
          name="bondSearch"
          label="Название или тикер"
          placeholder="Например, ОФЗ или SU26238"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showLookup}
          aria-controls={showLookup ? listboxId : undefined}
          aria-activedescendant={showLookup && activeOptionIndex >= 0 ? `${listboxId}-option-${activeOptionIndex}` : undefined}
          value={searchText}
          onChange={(event) => changeSearch(event.target.value)}
          onBlur={() => setDropdownOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && visibleSearchItems?.length) {
              event.preventDefault();
              setDropdownOpen(true);
              setActiveOptionIndex((index) => (index + 1) % visibleSearchItems.length);
            }
            if (event.key === 'ArrowUp' && visibleSearchItems?.length) {
              event.preventDefault();
              setDropdownOpen(true);
              setActiveOptionIndex((index) => (
                index <= 0 ? visibleSearchItems.length - 1 : index - 1
              ));
            }
            if (event.key === 'Enter' && activeOptionIndex >= 0 && visibleSearchItems?.[activeOptionIndex]) {
              event.preventDefault();
              selectBond(visibleSearchItems[activeOptionIndex]);
            }
            if (event.key === 'Escape') {
              setDropdownOpen(false);
              setActiveOptionIndex(-1);
            }
          }}
        />
        {showLookup ? (
          <div id={listboxId} className={styles.lookupMenu} role="listbox" aria-label="Результаты поиска облигаций">
            {searchPending ? <p aria-live="polite">Ищем облигации…</p> : null}
            {!searchPending ? visibleSearchItems?.map((item, index) => (
              <button
                id={`${listboxId}-option-${index}`}
                key={item.instrumentUid}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={activeOptionIndex === index}
                className={styles.lookupOption}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveOptionIndex(index)}
                onClick={() => selectBond(item)}
              >
                <strong>{item.ticker}</strong><span>{item.name}</span>
              </button>
            )) : null}
            {!searchPending && searchItems?.length === 0 ? <p>Облигации не найдены</p> : null}
            {searchError ? (
              <p className={styles.inlineError} role="alert">
                Не удалось найти облигации.{' '}
                <button type="button" onClick={() => void search.refetch()}>Повторить поиск</button>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

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
                min={selectedBond.placementDate}
                max={today}
                wide
                error={errors.purchaseDate?.message}
                {...register('purchaseDate', {
                  required: 'Укажите дату покупки',
                  validate: (value) => {
                    if (value > today) return 'Дата покупки не может быть в будущем';
                    if (value < selectedBond.placementDate) return 'Дата покупки должна быть не раньше размещения';
                    return value < selectedBond.maturityDate || 'Дата покупки должна быть раньше погашения';
                  },
                })}
              />
            </div>
          </section>
          {submitError ? <p className={styles.formError} role="alert">{submitError}</p> : null}
          <div className={styles.submitRow}>
            <Button
              className={styles.submitButton}
              type="submit"
              disabled={!isValid || !selectionIsCurrent || !nameAvailable || busy}
            >
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </div>
        </>
      ) : null}
    </form>
  );
}
