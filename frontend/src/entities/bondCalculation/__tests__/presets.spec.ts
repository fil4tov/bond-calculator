import { beforeEach, describe, expect, it } from 'vitest';

import {
  deserializePresetStore,
  normalizePresetName,
  PRESETS_STORAGE_KEY,
  readPresets,
  sortPresets,
  upsertPreset,
  writePresets,
} from '../index';
import type { SavedBondCalculation } from '../index';

const makePreset = (id: string, name: string, purchasePrice = 1000): SavedBondCalculation => ({
  id, name, normalizedName: normalizePresetName(name), updatedAt: '2026-08-08T00:00:00.000Z',
  fields: {
    nominal: 1000, purchasePrice, coupon: 45, paymentsPerYear: 2, purchaseMode: 'quantity', quantity: 1,
    investmentAmount: purchasePrice, holdToMaturity: 'no', maturityDate: '', holdingYears: 5, holdingMonths: 0, salePrice: 1000,
  },
});

describe('preset persistence', () => {
  beforeEach(() => localStorage.clear());

  it('normalizes and sorts Russian names', () => {
    expect(normalizePresetName('  ОФЗ 26238  ')).toBe('офз 26238');
    expect(sortPresets([makePreset('3', 'Якорь'), makePreset('2', 'альфа'), makePreset('1', 'Бета')]).map(({ name }) => name))
      .toEqual(['альфа', 'Бета', 'Якорь']);
  });

  it('overwrites a case-insensitive match and keeps its id', () => {
    const updated = upsertPreset([makePreset('existing', 'ОФЗ 26238', 950)], makePreset('new', '  офз 26238  ', 975));
    expect(updated).toHaveLength(1);
    expect(updated[0]?.id).toBe('existing');
    expect(updated[0]?.fields.purchasePrice).toBe(975);
  });

  it('rejects malformed stores and keeps compatible version 1 data', () => {
    expect(deserializePresetStore('not-json')).toEqual([]);
    expect(deserializePresetStore('{"version":2,"items":[]}')).toEqual([]);
    const items = [makePreset('1', 'Алроса')];
    expect(writePresets(items)).toBe(true);
    expect(JSON.parse(localStorage.getItem(PRESETS_STORAGE_KEY) ?? '{}').version).toBe(1);
    expect(readPresets()[0]?.name).toBe('Алроса');
  });
});
