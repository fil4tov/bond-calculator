import type { BondCouponScheduleItem } from '#entities/bondPortfolio';

export interface CouponScheduleYearGroup {
  year: number;
  events: BondCouponScheduleItem[];
  total: string;
}

function toKopecks(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error('Expected a non-negative plain money value');
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
}

function fromKopecks(value: bigint) {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
}

export function isZeroMoney(value: string) {
  return toKopecks(value) === 0n;
}

export function groupCouponScheduleByYear(
  events: BondCouponScheduleItem[],
): CouponScheduleYearGroup[] {
  const grouped = new Map<number, BondCouponScheduleItem[]>();
  const ordered = [...events].sort((left, right) => (
    right.payDate.localeCompare(left.payDate) || right.couponNumber - left.couponNumber
  ));

  ordered.forEach((event) => {
    const year = Number(event.payDate.slice(0, 4));
    grouped.set(year, [...(grouped.get(year) ?? []), event]);
  });

  return [...grouped.entries()].map(([year, yearEvents]) => ({
    year,
    events: yearEvents,
    total: fromKopecks(yearEvents.reduce(
      (sum, event) => sum + toKopecks(event.amount),
      0n,
    )),
  }));
}
