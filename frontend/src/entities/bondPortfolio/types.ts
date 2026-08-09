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
  daysUntil: number;
  periodDays: number;
  elapsedPeriodDays: number;
}

export interface BondPortfolioItem {
  id: string;
  name: string;
  couponAmount: string;
  nominal: string;
  paymentsPerYear: number;
  couponPeriodDays: number;
  placementDate: string;
  maturityDate: string;
  status: BondPortfolioStatus;
  totalQuantity: number;
  totalSpent: string;
  paidCouponTotal: string;
  annualCouponYieldPercent: string;
  maturityRemaining: BondMaturityRemaining;
  nextCoupon: BondNextCoupon | null;
}

export interface CreateBondInput {
  name: string;
  couponAmount: string;
  nominal: string;
  paymentsPerYear: number;
  couponPeriodDays?: number;
  placementDate: string;
  maturityDate: string;
  amountSpent: string;
  quantity: number;
  purchaseDate: string;
}

export interface AddBondPurchaseInput {
  amountSpent: string;
  quantity: number;
  purchaseDate: string;
}
