import { readPurchaseMode } from '#entities/bondCalculation';

import type { BondCalculatorFormValues } from '../../../types';
import { formatted } from './formatted';
import { getDefaultMaturityDate } from './getDefaultMaturityDate';

export function getDefaultValues(): BondCalculatorFormValues {
  return {
    bondName: '', nominal: formatted(1000), purchasePrice: formatted(950), coupon: formatted(45),
    paymentsPerYear: formatted(2, true), purchaseMode: readPurchaseMode(), quantity: formatted(100, true),
    investmentAmount: formatted(95000), holdToMaturity: 'yes', maturityDate: getDefaultMaturityDate(),
    holdingYears: formatted(5, true), holdingMonths: formatted(0, true), salePrice: formatted(1000),
  };
}
