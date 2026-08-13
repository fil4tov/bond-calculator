import { calculateHoldingYearsFromDate, combineHoldingPeriod } from '#entities/bondCalculation';
import { parseFormattedNumber } from '#shared/lib/number';

import type { BondCalculatorFormValues } from '../../../types';
import type { CalculationValidation, ValidationErrors } from './types';

export function validateCalculation(values: BondCalculatorFormValues): CalculationValidation {
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
