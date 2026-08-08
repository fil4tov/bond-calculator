const DISALLOWED_MINUS_PATTERN = /[-−–—]/;

export const containsDisallowedMinus = (value: unknown) => typeof value === 'string'
  && DISALLOWED_MINUS_PATTERN.test(value);

export function isValidNumericDraft(value: unknown) {
  if (typeof value !== 'string') return false;
  return /^\d*(?:[.,]\d*)?$/.test(value.replace(/[\s\u00a0\u202f]/g, ''));
}

export function parseFormattedNumber(value: string) {
  const normalized = value.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  return normalized === '' ? Number.NaN : Number(normalized);
}

export function formatEditableNumber(value: number) {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : '';
}

const decimalFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: true,
});
const integerFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0, useGrouping: true });

export function formatInputNumber(value: string | number, integer = false) {
  const numeric = typeof value === 'number' ? value : parseFormattedNumber(value);
  return Number.isFinite(numeric) ? (integer ? integerFormatter : decimalFormatter).format(numeric) : '';
}
