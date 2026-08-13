import type { BondPortfolioItem } from '#entities/bondPortfolio';

export type PortfolioSummaryBond = Pick<
  BondPortfolioItem,
  | 'positionStatus'
  | 'marketValueWithoutAci'
  | 'accruedCouponIncome'
  | 'positionCostBasis'
  | 'paidCouponTotal'
  | 'calendarYearPaidCouponIncome'
  | 'calendarYearCouponIncome'
  | 'calendarMonthCouponIncome'
  | 'couponYieldYear'
>;

export interface PortfolioSummaryData {
  marketValue: string | null;
  investedAmount: string;
  openIssueCount: number;
  currentResult: string | null;
  couponReceived: string;
  couponReceivedTotal: string;
  couponExpected: string;
  couponMonth: string;
  couponProgress: number;
  couponYear: number;
}
