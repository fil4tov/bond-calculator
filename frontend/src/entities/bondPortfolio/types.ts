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

export interface BondPurchaseHistoryItem {
  id: string;
  amountSpent: string;
  quantity: number;
  purchaseDate: string;
}

export interface BondPortfolioItem {
  id: string;
  name: string;
  nominal: string;
  paymentsPerYear: number;
  placementDate: string;
  maturityDate: string;
  status: BondPortfolioStatus;
  totalQuantity: number;
  totalSpent: string;
  paidCouponTotal: string;
  annualCouponYieldPercent: string;
  maturityRemaining: BondMaturityRemaining;
  nextCoupon: BondNextCoupon | null;
  purchases: BondPurchaseHistoryItem[];
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

export interface AddBondPurchaseInput {
  amountSpent: string;
  quantity: number;
  purchaseDate: string;
}
