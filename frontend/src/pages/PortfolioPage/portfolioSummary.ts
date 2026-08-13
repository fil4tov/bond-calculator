import type { BondPortfolioItem } from '#entities/bondPortfolio';

import { currentMarketValue } from './utils';

type PortfolioSummaryBond = Pick<
  BondPortfolioItem,
  | 'positionStatus'
  | 'marketValueWithoutAci'
  | 'accruedCouponIncome'
  | 'positionCostBasis'
  | 'calendarYearPaidCouponIncome'
  | 'calendarYearCouponIncome'
  | 'calendarMonthCouponIncome'
  | 'couponYieldYear'
>;

export interface PortfolioSummary {
  marketValue: string | null;
  investedAmount: string;
  openIssueCount: number;
  currentResult: string | null;
  couponReceived: string;
  couponExpected: string;
  couponMonth: string;
  couponProgress: number;
  couponYear: number;
}

function toKopecks(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error('Expected a plain money value');
  const amount = BigInt(match[2]!) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'));
  return match[1] ? -amount : amount;
}

function fromKopecks(value: bigint) {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

function sumMoney(values: string[]) {
  return values.reduce((total, value) => total + toKopecks(value), 0n);
}

export function calculatePortfolioSummary(bonds: PortfolioSummaryBond[]): PortfolioSummary {
  const openBonds = bonds.filter((bond) => bond.positionStatus === 'open');
  const marketValues = openBonds.map(currentMarketValue);
  const hasUnavailableMarketValue = marketValues.some((value) => value === null);
  const investedAmount = sumMoney(openBonds.map((bond) => bond.positionCostBasis));
  const marketValue = hasUnavailableMarketValue
    ? null
    : sumMoney(marketValues as string[]);
  const couponReceived = sumMoney(bonds.map((bond) => bond.calendarYearPaidCouponIncome));
  const couponExpected = sumMoney(bonds.map((bond) => bond.calendarYearCouponIncome));
  const couponMonth = sumMoney(bonds.map((bond) => bond.calendarMonthCouponIncome));
  const rawProgress = couponExpected > 0n
    ? Number((couponReceived * 10_000n + couponExpected / 2n) / couponExpected) / 100
    : 0;

  return {
    marketValue: marketValue === null ? null : fromKopecks(marketValue),
    investedAmount: fromKopecks(investedAmount),
    openIssueCount: openBonds.length,
    currentResult: marketValue === null ? null : fromKopecks(marketValue - investedAmount),
    couponReceived: fromKopecks(couponReceived),
    couponExpected: fromKopecks(couponExpected),
    couponMonth: fromKopecks(couponMonth),
    couponProgress: Math.min(100, Math.max(0, rawProgress)),
    couponYear: bonds[0]?.couponYieldYear ?? new Date().getUTCFullYear(),
  };
}
