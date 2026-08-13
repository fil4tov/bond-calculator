export function couponProgress(periodDays: number, elapsedPeriodDays: number) {
  if (periodDays <= 0) return 0;
  const value = (elapsedPeriodDays / periodDays) * 100;
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}
