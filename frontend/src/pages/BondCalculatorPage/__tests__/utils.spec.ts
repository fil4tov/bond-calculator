import { describe, expect, it } from 'vitest';

import { collectPreset } from '../utils';

describe('collectPreset', () => {
  it('normalizes the name and converts formatted form values to numbers', () => {
    const preset = collectPreset({
      bondName: '  ОФЗ 26238  ',
      nominal: '1 000',
      purchasePrice: '950,5',
      coupon: '45,25',
      paymentsPerYear: '2',
      purchaseMode: 'amount',
      quantity: '105',
      investmentAmount: '100 000',
      holdToMaturity: 'no',
      maturityDate: '2031-08-14',
      holdingYears: '4',
      holdingMonths: '6',
      salePrice: '1 025,75',
    });

    expect(preset).toMatchObject({
      name: 'ОФЗ 26238',
      normalizedName: 'офз 26238',
      fields: {
        nominal: 1000,
        purchasePrice: 950.5,
        coupon: 45.25,
        paymentsPerYear: 2,
        purchaseMode: 'amount',
        quantity: 105,
        investmentAmount: 100000,
        holdToMaturity: 'no',
        maturityDate: '2031-08-14',
        holdingYears: 4,
        holdingMonths: 6,
        salePrice: 1025.75,
      },
    });
    expect(preset.id).not.toBe('');
    expect(Number.isNaN(Date.parse(preset.updatedAt))).toBe(false);
  });
});
