import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { FieldPath } from 'react-hook-form';
import { FaArrowRight } from 'react-icons/fa';
import { FaArrowRotateLeft } from 'react-icons/fa6';

import {
  calculateBond,
  calculateHoldingYearsFromDate,
  calculateInvestmentAmount,
  calculateInvestmentRemainder,
  calculatePurchasableQuantity,
  combineHoldingPeriod,
  readPurchaseMode,
  writePurchaseMode,
} from '#entities/bondCalculation';
import type {
  BondCalculationInput,
  BondCalculationResult,
  HoldingMode,
  PurchaseMode,
  SavedBondCalculation,
} from '#entities/bondCalculation';
import { formatInputNumber, parseFormattedNumber } from '#shared/lib/number';
import { Button, ControlledNumberField, IconButton, SegmentedControl, TextField, Typography } from '#shared/ui';

import styles from '../../BondCalculatorPage.module.scss';
import type { BondCalculatorFormValues } from '../../types';

interface BondCalculatorFormProps {
  onResultChange: (result: BondCalculationResult | null) => void;
  onHoldingModeChange: (mode: HoldingMode) => void;
  onClear?: () => void;
}

export interface BondCalculatorFormHandle {
  prepareSave: () => BondCalculatorFormValues | null;
  restorePreset: (preset: SavedBondCalculation) => void;
  setBondName: (name: string) => void;
}

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const toLocalDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultMaturityDate = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setFullYear(date.getFullYear() + 5);
  return toLocalDateInputValue(date);
};

const getTomorrow = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return toLocalDateInputValue(date);
};

const formatted = (value: number, integer = false) => formatInputNumber(value, integer);

function getDefaultValues(): BondCalculatorFormValues {
  return {
    bondName: '', nominal: formatted(1000), purchasePrice: formatted(950), coupon: formatted(45),
    paymentsPerYear: formatted(2, true), purchaseMode: readPurchaseMode(), quantity: formatted(100, true),
    investmentAmount: formatted(95000), holdToMaturity: 'yes', maturityDate: getDefaultMaturityDate(),
    holdingYears: formatted(5, true), holdingMonths: formatted(0, true), salePrice: formatted(1000),
  };
}

type ValidationErrors = Partial<Record<FieldPath<BondCalculatorFormValues>, string>>;

interface CalculationValidation {
  errors: ValidationErrors;
  input: BondCalculationInput | null;
}

const calculationFields = [
  'nominal',
  'purchasePrice',
  'coupon',
  'paymentsPerYear',
  'quantity',
  'investmentAmount',
  'maturityDate',
  'holdingYears',
  'holdingMonths',
  'salePrice',
] as const satisfies readonly FieldPath<BondCalculatorFormValues>[];

function validateCalculation(values: BondCalculatorFormValues): CalculationValidation {
  const nominal = parseFormattedNumber(values.nominal);
  const purchasePrice = parseFormattedNumber(values.purchasePrice);
  const coupon = parseFormattedNumber(values.coupon);
  const paymentsPerYear = parseFormattedNumber(values.paymentsPerYear);
  const quantity = parseFormattedNumber(values.quantity);
  const investmentAmount = parseFormattedNumber(values.investmentAmount);
  const holdingYearsValue = parseFormattedNumber(values.holdingYears);
  const holdingMonths = parseFormattedNumber(values.holdingMonths);
  const salePrice = parseFormattedNumber(values.salePrice);
  const errors: ValidationErrors = {};

  if (!Number.isFinite(nominal) || nominal <= 0) errors.nominal = 'Введите номинал больше нуля';
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) errors.purchasePrice = 'Введите цену облигации больше нуля';
  if (!Number.isFinite(paymentsPerYear) || paymentsPerYear <= 0) errors.paymentsPerYear = 'Введите целое количество выплат в год';
  if (values.purchaseMode === 'amount') {
    if (!Number.isFinite(investmentAmount) || investmentAmount <= 0) {
      errors.investmentAmount = 'Введите сумму вложения больше нуля';
    } else if (!Number.isInteger(quantity) || quantity < 1) {
      errors.investmentAmount = 'Этой суммы недостаточно для покупки хотя бы одной облигации';
    }
  } else if (!Number.isInteger(quantity) || quantity < 1) {
    errors.quantity = 'Введите целое количество облигаций';
  }
  if (!Number.isFinite(coupon) || coupon < 0) errors.coupon = 'Купон не может быть отрицательным';

  let holdingYears: number;
  let exitPrice: number;
  if (values.holdToMaturity === 'yes') {
    holdingYears = calculateHoldingYearsFromDate(values.maturityDate);
    exitPrice = nominal;
    if (!Number.isFinite(holdingYears) || holdingYears <= 0) errors.maturityDate = 'Дата погашения должна быть позже сегодняшней';
  } else {
    if (!Number.isInteger(holdingYearsValue) || holdingYearsValue < 0) errors.holdingYears = 'Количество лет должно быть целым неотрицательным числом';
    if (!Number.isInteger(holdingMonths) || holdingMonths < 0 || holdingMonths > 11) errors.holdingMonths = 'Количество месяцев должно быть целым числом от 0 до 11';
    holdingYears = combineHoldingPeriod(holdingYearsValue, holdingMonths);
    exitPrice = salePrice;
    if (!errors.holdingYears && !errors.holdingMonths && (!Number.isFinite(holdingYears) || holdingYears <= 0)) errors.holdingYears = 'Введите срок владения больше нуля';
    if (!Number.isFinite(exitPrice) || exitPrice <= 0) errors.salePrice = 'Введите ожидаемую цену продажи больше нуля';
  }

  if (Object.keys(errors).length > 0) return { errors, input: null };
  return { errors, input: { nominal, purchasePrice, quantity, coupon, paymentsPerYear, holdingYears, exitPrice } };
}

export const BondCalculatorForm = forwardRef<BondCalculatorFormHandle, BondCalculatorFormProps>(function BondCalculatorForm(
  { onResultChange, onHoldingModeChange, onClear },
  ref,
) {
  const defaults = useMemo(() => getDefaultValues(), []);
  const { control, register, handleSubmit, reset, getValues, setValue, setError, clearErrors, watch, formState: { errors } } = useForm<BondCalculatorFormValues>({ defaultValues: defaults });
  const values = useWatch({ control }) as BondCalculatorFormValues;
  const [hasSuccessfulCalculation, setHasSuccessfulCalculation] = useState(false);
  const bondNameRegistration = register('bondName');

  const applyValidationErrors = useCallback((validationErrors: ValidationErrors, focus = false) => {
    clearErrors([...calculationFields]);
    let shouldFocus = focus;
    calculationFields.forEach((field) => {
      const message = validationErrors[field];
      if (!message) return;
      setError(field, { type: 'validate', message }, { shouldFocus });
      shouldFocus = false;
    });
  }, [clearErrors, setError]);

  useEffect(() => {
    writePurchaseMode(values.purchaseMode);
  }, [values.purchaseMode]);

  useEffect(() => {
    onHoldingModeChange(values.holdToMaturity);
  }, [onHoldingModeChange, values.holdToMaturity]);

  useEffect(() => {
    const price = parseFormattedNumber(values.purchasePrice);
    if (values.purchaseMode === 'quantity') {
      const quantity = parseFormattedNumber(values.quantity);
      const amount = Number.isInteger(quantity) && quantity > 0 && price > 0 ? calculateInvestmentAmount(price, quantity) : Number.NaN;
      const next = formatted(amount);
      if (values.investmentAmount !== next) setValue('investmentAmount', next);
    }
  }, [setValue, values.purchaseMode, values.purchasePrice, values.quantity, values.investmentAmount]);

  useEffect(() => {
    const price = parseFormattedNumber(values.purchasePrice);
    if (values.purchaseMode === 'amount') {
      const amount = parseFormattedNumber(values.investmentAmount);
      const quantity = Number.isFinite(amount) && amount > 0 && price > 0 ? calculatePurchasableQuantity(amount, price) : Number.NaN;
      const next = formatted(quantity, true);
      if (values.quantity !== next) setValue('quantity', next);
    }
  }, [setValue, values.purchaseMode, values.purchasePrice, values.investmentAmount, values.quantity]);

  useEffect(() => {
    const subscription = watch((nextValues, { name }) => {
      if (!name) return;

      const formValues = nextValues as BondCalculatorFormValues;
      const validation = validateCalculation(formValues);
      applyValidationErrors(validation.errors);

      if (name === 'bondName' && formValues.bondName.trim()) clearErrors('bondName');
      if (hasSuccessfulCalculation && validation.input) onResultChange(calculateBond(validation.input));
    });
    return () => subscription.unsubscribe();
  }, [applyValidationErrors, clearErrors, hasSuccessfulCalculation, onResultChange, watch]);

  const runCalculation = (formValues: BondCalculatorFormValues, focus = true) => {
    const validation = validateCalculation(formValues);
    applyValidationErrors(validation.errors, focus);
    if (!validation.input) return false;
    onResultChange(calculateBond(validation.input));
    setHasSuccessfulCalculation(true);
    return true;
  };

  useImperativeHandle(ref, () => ({
    prepareSave: () => {
      const formValues = getValues();
      const name = formValues.bondName.trim();
      clearErrors();
      if (!name) {
        setError('bondName', { type: 'required', message: 'Введите название облигации, чтобы сохранить расчёт' }, { shouldFocus: true });
        return null;
      }
      return runCalculation(formValues) ? formValues : null;
    },
    restorePreset: (preset) => {
      const { fields } = preset;
      const restored: BondCalculatorFormValues = {
        bondName: preset.name, nominal: formatted(fields.nominal), purchasePrice: formatted(fields.purchasePrice),
        coupon: formatted(fields.coupon), paymentsPerYear: formatted(fields.paymentsPerYear, true),
        purchaseMode: fields.purchaseMode === 'amount' ? 'amount' : 'quantity', quantity: formatted(fields.quantity, true),
        investmentAmount: formatted(fields.investmentAmount), holdToMaturity: fields.holdToMaturity === 'no' ? 'no' : 'yes',
        maturityDate: fields.maturityDate, holdingYears: formatted(fields.holdingYears, true),
        holdingMonths: formatted(fields.holdingMonths, true), salePrice: formatted(fields.salePrice),
      };
      reset(restored);
      runCalculation(restored, false);
      requestAnimationFrame(() => document.getElementById('bond-name')?.focus());
    },
    setBondName: (name) => setValue('bondName', name),
  }));

  const handleClear = () => {
    const current = getValues();
    reset({
      bondName: '', nominal: '', purchasePrice: '', coupon: '', paymentsPerYear: '',
      purchaseMode: current.purchaseMode, quantity: '', investmentAmount: '', holdToMaturity: current.holdToMaturity,
      maturityDate: '', holdingYears: '', holdingMonths: '', salePrice: '',
    });
    onResultChange(null);
    setHasSuccessfulCalculation(false);
    onClear?.();
    requestAnimationFrame(() => document.getElementById('bond-name')?.focus());
  };

  const purchasePrice = parseFormattedNumber(values.purchasePrice);
  const purchaseQuantity = parseFormattedNumber(values.quantity);
  const investmentAmount = parseFormattedNumber(values.investmentAmount);
  const remainder = values.purchaseMode === 'amount' && purchaseQuantity >= 1
    ? calculateInvestmentRemainder(investmentAmount, purchasePrice, purchaseQuantity)
    : null;

  return (
    <form className={styles.formPanel} noValidate onSubmit={handleSubmit((formValues) => { runCalculation(formValues); })}>
      <div className={styles.panelHeading}>
        <span className={styles.stepNumber}>1</span>
        <div><Typography as="h2" variant="title">Параметры облигации</Typography><p>Укажите данные одной бумаги и объём покупки</p></div>
        <IconButton className={styles.resetButton} icon={<FaArrowRotateLeft />} size="small" type="button" aria-label="Очистить форму" title="Очистить форму" onClick={handleClear} />
      </div>
      <div className={styles.bondNameSection}>
        <TextField
          id="bond-name" label="Название облигации" hint="(обязательно только для сохранения)" placeholder="Например, ОФЗ 26238"
          autoComplete="off" maxLength={80} wide error={errors.bondName?.message} {...bondNameRegistration}
        />
      </div>
      <div className={styles.formGrid}>
        <ControlledNumberField control={control} name="nominal" label="Номинал облигации" unit="₽" inputMode="decimal" error={errors.nominal?.message} />
        <ControlledNumberField control={control} name="purchasePrice" label="Цена облигации" hint="(с учётом НКД и комиссий)" unit="₽" inputMode="decimal" error={errors.purchasePrice?.message} />
        <ControlledNumberField control={control} name="coupon" label="Величина купона" unit="₽" inputMode="decimal" error={errors.coupon?.message} />
        <ControlledNumberField control={control} name="paymentsPerYear" label="Количество выплат в год" unit="раз" inputMode="numeric" integer error={errors.paymentsPerYear?.message} />
      </div>
      <section className={styles.purchaseSection} aria-labelledby="purchase-title">
        <div className={styles.choiceRow}>
          <strong id="purchase-title">Рассчитать по</strong>
          <Controller control={control} name="purchaseMode" render={({ field }) => (
            <SegmentedControl<PurchaseMode> name="purchaseMode" value={field.value} onChange={field.onChange} ariaLabel="Рассчитать по" options={[{ value: 'quantity', label: 'Количеству облигаций' }, { value: 'amount', label: 'Сумме вложения' }]} />
          )} />
        </div>
        <div className={styles.purchaseGrid}>
          <ControlledNumberField control={control} name="quantity" label="Количество облигаций" unit="шт." inputMode="numeric" integer disabled={values.purchaseMode === 'amount'} error={errors.quantity?.message} />
          <ControlledNumberField control={control} name="investmentAmount" label="Сумма вложения" unit="₽" inputMode="decimal" disabled={values.purchaseMode === 'quantity'} error={errors.investmentAmount?.message} />
          {values.purchaseMode === 'amount' ? <div className={styles.remainder} aria-live="polite" aria-atomic="true"><span>Остаток после покупки</span><strong>{remainder === null ? '—' : currencyFormatter.format(remainder)}</strong></div> : null}
        </div>
      </section>
      <div className={styles.choiceRow}>
        <strong>Держать до погашения?</strong>
        <Controller control={control} name="holdToMaturity" render={({ field }) => (
          <SegmentedControl<HoldingMode> compact name="holdToMaturity" value={field.value} onChange={field.onChange} ariaLabel="Держать до погашения" options={[{ value: 'yes', label: 'Да' }, { value: 'no', label: 'Нет' }]} />
        )} />
      </div>
      {values.holdToMaturity === 'yes' ? (
        <div className={styles.conditionalFields}>
          <TextField type="date" label="Дата погашения" wide min={getTomorrow()} error={errors.maturityDate?.message} {...register('maturityDate')} />
          <p className={styles.fieldHint}>Срок владения рассчитывается от сегодняшнего дня</p>
        </div>
      ) : (
        <div className={`${styles.conditionalFields} ${styles.conditionalGrid}`}>
          <ControlledNumberField control={control} name="holdingYears" label="Срок владения" unit="лет" inputMode="numeric" integer error={errors.holdingYears?.message} />
          <ControlledNumberField control={control} name="holdingMonths" label="Месяцев" unit="мес." inputMode="numeric" integer error={errors.holdingMonths?.message} />
          <ControlledNumberField control={control} name="salePrice" label="Ожидаемая цена продажи" hint="(с учётом НКД и комиссий)" unit="₽" inputMode="decimal" wide error={errors.salePrice?.message} />
        </div>
      )}
      <div className={styles.panelAction}><Button type="submit" trailingIcon={<FaArrowRight />}>Рассчитать доходность</Button></div>
    </form>
  );
});
