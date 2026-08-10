export type PurchaseMode = 'quantity' | 'amount';
export type HoldingMode = 'yes' | 'no';

export interface BondCalculationInput {
  nominal: number;
  purchasePrice: number;
  quantity: number;
  coupon: number;
  paymentsPerYear: number;
  holdingYears: number;
  exitPrice: number;
}

export interface BondCalculationResult extends BondCalculationInput {
  investment: number;
  annualCoupons: number;
  paymentAmount: number;
  priceDifference: number;
  annualIncome: number;
  annualYield: number;
  couponIncomeTotal: number;
  totalProfit: number;
  annualYieldWithPrice: number;
  finalAmount: number;
}

export interface SavedBondCalculationFields {
  nominal: number;
  purchasePrice: number;
  coupon: number;
  paymentsPerYear: number;
  purchaseMode: PurchaseMode;
  quantity: number;
  investmentAmount: number;
  holdToMaturity: HoldingMode;
  maturityDate: string;
  holdingYears: number;
  holdingMonths: number;
  salePrice: number;
}

export interface SavedBondCalculation {
  id: string;
  name: string;
  normalizedName: string;
  updatedAt: string;
  fields: SavedBondCalculationFields;
}
