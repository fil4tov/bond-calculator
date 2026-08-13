import { createPresetId, normalizePresetName } from '#entities/bondCalculation';
import type { SavedBondCalculation } from '#entities/bondCalculation';
import { parseFormattedNumber } from '#shared/lib/number';

import type { BondCalculatorFormValues } from './types';

export function collectPreset(formValues: BondCalculatorFormValues): SavedBondCalculation {
  const name = formValues.bondName.trim();
  return {
    id: createPresetId(),
    name,
    normalizedName: normalizePresetName(name),
    updatedAt: new Date().toISOString(),
    fields: {
      nominal: parseFormattedNumber(formValues.nominal),
      purchasePrice: parseFormattedNumber(formValues.purchasePrice),
      coupon: parseFormattedNumber(formValues.coupon),
      paymentsPerYear: parseFormattedNumber(formValues.paymentsPerYear),
      purchaseMode: formValues.purchaseMode,
      quantity: parseFormattedNumber(formValues.quantity),
      investmentAmount: parseFormattedNumber(formValues.investmentAmount),
      holdToMaturity: formValues.holdToMaturity,
      maturityDate: formValues.maturityDate,
      holdingYears: parseFormattedNumber(formValues.holdingYears),
      holdingMonths: parseFormattedNumber(formValues.holdingMonths),
      salePrice: parseFormattedNumber(formValues.salePrice),
    },
  };
}
