import { parseFormattedNumber } from '#shared/lib/number';

type QuantityOperation = { operationType: 'purchase' | 'sale'; quantity: number; operationDate: string };

export const MONEY_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;
const TOO_MANY_FRACTION_DIGITS_PATTERN = /^\d+[.,]\d{3,}$/;
const MAX_MONEY_INTEGER_DIGITS = 16;
const MAX_POSTGRES_INTEGER = '2147483647';

const INTEGER_FORMATTER = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
  useGrouping: true,
});
const MONEY_FORMATTER = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const PERCENT_FORMATTER = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function pluralizeRu(value: number, forms: [string, string, string]) {
  const normalized = Math.abs(value) % 100;
  const lastDigit = normalized % 10;
  if (normalized > 10 && normalized < 20) return forms[2];
  if (lastDigit === 1) return forms[0];
  if (lastDigit >= 2 && lastDigit <= 4) return forms[1];
  return forms[2];
}

export function formatYearCount(years: number) {
  return `${years} ${pluralizeRu(years, ['г.', 'г.', 'л.'])}`;
}

export function formatDayCount(days: number) {
  return `${days.toLocaleString('ru-RU')} ${pluralizeRu(days, ['день', 'дня', 'дней'])}`;
}

export function canonicalDecimal(value: string) {
  const normalized = value.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  const [integer = '0', fraction = ''] = normalized.split('.');
  const canonicalInteger = integer.replace(/^0+(?=\d)/, '');
  return `${canonicalInteger}.${fraction.padEnd(2, '0')}`;
}

export function todayInputValue(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function validateMoney(value: string, { allowZero, label }: { allowZero: boolean; label: string }) {
  const compact = value.replace(/[\s\u00a0\u202f]/g, '');
  if (!compact) return `Введите ${label.toLocaleLowerCase('ru-RU')}`;
  if (TOO_MANY_FRACTION_DIGITS_PATTERN.test(compact)) return 'Не больше двух знаков после запятой';
  if (!MONEY_PATTERN.test(compact) || !Number.isFinite(parseFormattedNumber(value))) {
    return 'Введите обычное десятичное число с максимум двумя знаками после запятой';
  }
  const [integer = '', fraction = ''] = compact.replace(',', '.').split('.');
  if (integer.replace(/^0+/, '').length > MAX_MONEY_INTEGER_DIGITS) return 'Не более 16 цифр до запятой';
  const isZero = !/[1-9]/.test(`${integer}${fraction}`);
  if (!allowZero && isZero) return `${label} должен быть больше нуля`;
  return true;
}

export function validateQuantity(value: string) {
  const compact = value.replace(/[\s\u00a0\u202f]/g, '');
  const parsed = parseFormattedNumber(value);
  if (!/^\d+$/.test(compact) || !Number.isInteger(parsed) || parsed <= 0) {
    return 'Введите целое количество больше нуля';
  }
  const significant = compact.replace(/^0+/, '');
  if (!significant) return 'Введите целое количество больше нуля';
  if (
    significant.length > MAX_POSTGRES_INTEGER.length
    || (significant.length === MAX_POSTGRES_INTEGER.length && significant > MAX_POSTGRES_INTEGER)
  ) return 'Количество не может быть больше 2 147 483 647';
  return true;
}

function roundDecimal(value: string, fractionDigits: number) {
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new Error('Expected a plain decimal string');
  const negative = Boolean(match[1]);
  const integer = match[2] ?? '0';
  const fraction = match[3] ?? '';
  const scale = 10n ** BigInt(fractionDigits);
  const keptFraction = fraction.slice(0, fractionDigits).padEnd(fractionDigits, '0');
  let scaled = BigInt(integer) * scale + BigInt(keptFraction || '0');
  if ((fraction[fractionDigits] ?? '0') >= '5') scaled += 1n;
  return {
    negative: negative && scaled !== 0n,
    integer: scaled / scale,
    fraction: (scaled % scale).toString().padStart(fractionDigits, '0'),
  };
}

function formatExactDecimal(value: string, formatter: Intl.NumberFormat) {
  const rounded = roundDecimal(value, 2);
  const groupedInteger = INTEGER_FORMATTER.format(rounded.integer);
  const formatted = formatter.formatToParts(0n).map((part) => {
    if (part.type === 'integer') return groupedInteger;
    if (part.type === 'fraction') return rounded.fraction;
    return part.value;
  }).join('');
  return rounded.negative ? `−${formatted}` : formatted;
}

export function formatMoney(value: string) {
  return formatExactDecimal(value, MONEY_FORMATTER);
}

export function formatPercent(value: string) {
  return `${formatExactDecimal(value, PERCENT_FORMATTER)} %`;
}

export function couponYieldDescription(year: number) {
  return `Для каждого купона за ${year} год сумма выплаты по бумагам в позиции на дату отсечения делится на историческую себестоимость этой позиции на ту же дату и умножается на 100%. Полученные доходности купонов складываются. Дата отсечения — дата фиксации права, а если её нет — конец купонного периода, без учёта операций в этот день. Учитываются уже выплаченные и будущие купоны; возврат номинала не входит.`;
}

export function marketValueWithoutAciDescription() {
  return 'Текущая рыночная стоимость без учета НКД.';
}

export function calendarYearCouponIncomeDescription(year: number) {
  return `Ожидаемый купонный доход за ${year} год без учета выплаченного НКД по операциям продажи.`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

export function availableQuantityOnDate(operations: QuantityOperation[], date: string) {
  return operations.reduce((available, operation) => {
    if (operation.operationDate > date) return available;
    return operation.operationType === 'purchase'
      ? available + operation.quantity
      : available - operation.quantity;
  }, 0);
}
