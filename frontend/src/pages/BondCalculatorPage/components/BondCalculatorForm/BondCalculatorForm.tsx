import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { FieldPath } from 'react-hook-form';
import { FaArrowRight } from 'react-icons/fa';
import { FaArrowRotateLeft } from 'react-icons/fa6';

import {
  calculateBond,
  calculateInvestmentAmount,
  calculateInvestmentRemainder,
  calculatePurchasableQuantity,
  writePurchaseMode,
} from '#entities/bondCalculation';
import type {
  BondCalculationResult,
  HoldingMode,
  PurchaseMode,
  SavedBondCalculation,
} from '#entities/bondCalculation';
import { parseFormattedNumber } from '#shared/lib/number';
import { Button, ControlledNumberField, IconButton, SegmentedControl, TextField, Typography } from '#shared/ui';

import styles from '../../BondCalculatorPage.module.scss';
import type { BondCalculatorFormValues } from '../../types';
import { formatted, getDefaultValues, getTomorrow, validateCalculation } from './utils';
import type { ValidationErrors } from './utils';

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
