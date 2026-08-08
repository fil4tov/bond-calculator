import { DAYS_IN_YEAR } from './calculation';

const pluralizeRu = (value: number, forms: [string, string, string]) => {
  const normalized = Math.abs(value) % 100;
  const lastDigit = normalized % 10;
  if (normalized > 10 && normalized < 20) return forms[2];
  if (lastDigit === 1) return forms[0];
  if (lastDigit >= 2 && lastDigit <= 4) return forms[1];
  return forms[2];
};

export function formatHoldingPeriod(holdingYears: number) {
  const nearestWholeYear = Math.round(holdingYears);
  if (Math.abs(holdingYears - nearestWholeYear) * DAYS_IN_YEAR < 0.5) {
    return `${nearestWholeYear} ${pluralizeRu(nearestWholeYear, ['год', 'года', 'лет'])}`;
  }

  let years = Math.floor(holdingYears);
  const averageDaysInMonth = DAYS_IN_YEAR / 12;
  const remainingDays = Math.round((holdingYears - years) * DAYS_IN_YEAR);
  let months = Math.floor(remainingDays / averageDaysInMonth);
  let days = Math.round(remainingDays - months * averageDaysInMonth);
  if (days >= Math.round(averageDaysInMonth)) { months += 1; days = 0; }
  if (months >= 12) { years += 1; months -= 12; }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${pluralizeRu(years, ['год', 'года', 'лет'])}`);
  if (months > 0) parts.push(`${months} ${pluralizeRu(months, ['месяц', 'месяца', 'месяцев'])}`);
  if (days > 0) parts.push(`${days} ${pluralizeRu(days, ['день', 'дня', 'дней'])}`);
  return parts.join(' ') || '0 дней';
}

export function formatPaymentFrequency(paymentsPerYear: number) {
  if (!Number.isFinite(paymentsPerYear) || paymentsPerYear <= 0) return '';
  const months = 12 / paymentsPerYear;
  if (Math.abs(months - 1) < Number.EPSILON) return '(каждый месяц)';
  const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(months);
  return `(каждые ${formatted} ${pluralizeRu(months, ['месяц', 'месяца', 'месяцев'])})`;
}
