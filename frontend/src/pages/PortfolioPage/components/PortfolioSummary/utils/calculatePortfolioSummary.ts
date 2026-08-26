import { currentMarketValue } from '../../../utils';

import type { PortfolioSummaryBond, PortfolioSummaryData } from '../types';
import { fromKopecks } from './fromKopecks';
import { percentOf } from './percentOf';
import { sumMoney } from './sumMoney';

export function calculatePortfolioSummary(bonds: PortfolioSummaryBond[]): PortfolioSummaryData {
  const openBonds = bonds.filter((bond) => bond.positionStatus === 'open');
  const marketValues = openBonds.map(currentMarketValue);
  const hasUnavailableMarketValue = marketValues.some((value) => value === null);
  const investedAmount = sumMoney(openBonds.map((bond) => bond.positionCostBasis));
  const openCalendarYearCouponIncome = sumMoney(
    openBonds.map((bond) => bond.calendarYearCouponIncome),
  );
  const marketValue = hasUnavailableMarketValue
    ? null
    : sumMoney(marketValues as string[]);
  const couponReceived = sumMoney(bonds.map((bond) => bond.calendarYearPaidCouponIncome));
  const couponReceivedTotal = sumMoney(bonds.map((bond) => bond.paidCouponTotal));
  const couponExpected = sumMoney(bonds.map((bond) => bond.calendarYearCouponIncome));
  const couponMonth = sumMoney(bonds.map((bond) => bond.calendarMonthCouponIncome));
  const rawProgress = couponExpected > 0n
    ? Number((couponReceived * 10_000n + couponExpected / 2n) / couponExpected) / 100
    : 0;

  return {
    marketValue: marketValue === null ? null : fromKopecks(marketValue),
    investedAmount: fromKopecks(investedAmount),
    currentResult: marketValue === null ? null : fromKopecks(marketValue - investedAmount),
    calendarYearYieldPercent: percentOf(openCalendarYearCouponIncome, investedAmount),
    couponReceived: fromKopecks(couponReceived),
    couponReceivedTotal: fromKopecks(couponReceivedTotal),
    couponExpected: fromKopecks(couponExpected),
    couponMonth: fromKopecks(couponMonth),
    couponProgress: Math.min(100, Math.max(0, rawProgress)),
    couponYear: bonds[0]?.couponYieldYear ?? new Date().getUTCFullYear(),
  };
}
