import { describe, expect, it } from 'vitest';

import {
  canonicalDecimal,
  formatMoney,
  formatPercent,
  todayInputValue,
  validateQuantity,
} from '../utils';

describe('portfolio decimal utilities', () => {
  it('formats the maximum NUMERIC(18,2) value without losing kopecks', () => {
    expect(formatMoney('9999999999999999.99')).toBe('9\u00a0999\u00a0999\u00a0999\u00a0999\u00a0999,99\u00a0₽');
  });

  it('rounds a large backend percentage string without IEEE-754 precision loss', () => {
    expect(formatPercent('12345678901234567890.1250')).toBe('12\u00a0345\u00a0678\u00a0901\u00a0234\u00a0567\u00a0890,13 %');
  });

  it('normalizes accepted comma input to a canonical plain decimal string', () => {
    expect(canonicalDecimal('000001,2')).toBe('1.20');
  });

  it('normalizes calculator-style grouped input before sending it to the API', () => {
    expect(canonicalDecimal('9\u202f500,45')).toBe('9500.45');
    expect(validateQuantity('2\u00a0000')).toBe(true);
  });

  it('accepts the PostgreSQL INTEGER maximum quantity and rejects max plus one', () => {
    expect(validateQuantity('2147483647')).toBe(true);
    expect(validateQuantity('2147483648')).toBe('Количество не может быть больше 2 147 483 647');
  });

  it.each(['', '0', '-1', '1.5'])('keeps rejecting non-positive or non-integer quantity %j', (value) => {
    expect(validateQuantity(value)).toBe('Введите целое количество больше нуля');
  });

  it('derives the input date from UTC across a positive-offset midnight boundary', () => {
    const afterMidnightInMoscow = new Date('2026-08-10T00:30:00+03:00');

    expect(todayInputValue(afterMidnightInMoscow)).toBe('2026-08-09');
  });
});
