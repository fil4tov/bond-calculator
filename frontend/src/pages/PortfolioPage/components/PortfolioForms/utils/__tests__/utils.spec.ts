import { describe, expect, it } from 'vitest';

import { localizedFieldError, localizedSubmitError, previousDate } from '..';

describe('AddSaleForm utils', () => {
  it('returns the previous calendar date across a month boundary', () => {
    expect(previousDate('2026-08-01')).toBe('2026-07-31');
  });

  it('localizes known API fields and ignores an unknown field', () => {
    expect(localizedFieldError('quantity')).toContain('Количество');
    expect(localizedFieldError('sale_date')).toContain('Дата продажи');
    expect(localizedFieldError('amount_received')).toContain('сумму продажи');
    expect(localizedFieldError('unknown')).toBeNull();
  });

  it('separates validation and transport submit errors', () => {
    expect(localizedSubmitError('validation_error')).toContain('проверить данные продажи');
    expect(localizedSubmitError('server_error')).toContain('зафиксировать продажу');
  });
});
