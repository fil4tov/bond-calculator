import type { BondCouponPayment } from '#entities/bondPortfolio';

export interface CouponPaymentYearGroup {
  year: number;
  payments: BondCouponPayment[];
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

export function groupCouponPaymentsByYear(
  payments: BondCouponPayment[],
): CouponPaymentYearGroup[] {
  const grouped = new Map<number, BondCouponPayment[]>();
  const ordered = [...payments].sort((left, right) => (
    right.payDate.localeCompare(left.payDate) || right.couponNumber - left.couponNumber
  ));

  ordered.forEach((payment) => {
    const year = Number(payment.payDate.slice(0, 4));
    grouped.set(year, [...(grouped.get(year) ?? []), payment]);
  });

  return [...grouped.entries()].map(([year, yearPayments]) => ({
    year,
    payments: yearPayments,
    total: fromKopecks(yearPayments.reduce(
      (sum, payment) => sum + toKopecks(payment.amount),
      0n,
    )),
  }));
}
