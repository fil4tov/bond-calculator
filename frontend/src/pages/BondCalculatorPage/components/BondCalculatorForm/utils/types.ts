import type { FieldPath } from 'react-hook-form';

import type { BondCalculationInput } from '#entities/bondCalculation';

import type { BondCalculatorFormValues } from '../../../types';

export type ValidationErrors = Partial<Record<FieldPath<BondCalculatorFormValues>, string>>;

export interface CalculationValidation {
  errors: ValidationErrors;
  input: BondCalculationInput | null;
}
