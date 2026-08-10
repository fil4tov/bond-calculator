import type { HoldingMode, PurchaseMode } from '#entities/bondCalculation';

export interface BondCalculatorFormValues {
  bondName: string;
  nominal: string;
  purchasePrice: string;
  coupon: string;
  paymentsPerYear: string;
  purchaseMode: PurchaseMode;
  quantity: string;
  investmentAmount: string;
  holdToMaturity: HoldingMode;
  maturityDate: string;
  holdingYears: string;
  holdingMonths: string;
  salePrice: string;
}
