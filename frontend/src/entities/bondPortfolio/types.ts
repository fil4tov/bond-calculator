export type BondPortfolioStatus = 'active' | 'payment_pending' | 'matured';

export interface BondMaturityRemaining {
  years: number;
  months: number;
  daysUntil: number;
}

export interface BondNextCoupon {
  periodStart: string;
  periodEnd: string;
  payDate: string;
  amount: string;
  amountPerBond: string;
  daysUntil: number;
  periodDays: number;
  elapsedPeriodDays: number;
}

export type BondOperationType = 'purchase' | 'sale';
export type BondPositionStatus = 'open' | 'closed';

export interface BondOperation {
  id: string;
  operationType: BondOperationType;
  amount: string;
  quantity: number;
  operationDate: string;
  realizedResult: string | null;
}

export interface BondPortfolioItem {
  id: string;
  createdAt: string;
  name: string;
  nominal: string;
  paymentsPerYear: number;
  placementDate: string;
  maturityDate: string;
  status: BondPortfolioStatus;
  totalQuantity: number;
  totalSpent: string;
  positionCostBasis: string;
  marketValueWithoutAci: string | null;
  accruedCouponIncome: string | null;
  realizedResult: string;
  positionStatus: BondPositionStatus;
  paidCouponTotal: string;
  holdingPeriodCouponIncome: string;
  calendarYearPaidCouponIncome: string;
  calendarYearCouponYieldPercent: string;
  annualCouponYieldPercent: string | null;
  calendarYearCouponIncome: string;
  calendarMonthCouponIncome: string;
  couponYieldYear: number;
  maturityRemaining: BondMaturityRemaining;
  nextCoupon: BondNextCoupon | null;
  operations: BondOperation[];
}

export interface CreateBondInput {
  instrumentUid: string;
  ticker: string;
  name: string;
  nominal: string;
  paymentsPerYear: number;
  placementDate: string;
  maturityDate: string;
  amountSpent: string;
  quantity: number;
  purchaseDate: string;
}

export interface TInvestBondLookup {
  ticker: string;
  instrumentUid: string;
  name: string;
  nominal: string;
  paymentsPerYear: number;
  placementDate: string;
  maturityDate: string;
}

export interface TInvestBondSearchItem {
  ticker: string;
  instrumentUid: string;
  name: string;
}

export interface AddBondPurchaseInput {
  amountSpent: string;
  quantity: number;
  purchaseDate: string;
}

export interface AddBondSaleInput {
  amountReceived: string;
  quantity: number;
  saleDate: string;
}
