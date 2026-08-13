import { describe, expect, it } from 'vitest';

import { signedMoney } from '..';

describe('signedMoney', () => {
  it('adds a plus only to positive money values', () => {
    expect(signedMoney('10.50')).toMatch(/^\+/);
    expect(signedMoney('-10.50')).not.toMatch(/^\+/);
    expect(signedMoney('0.00')).not.toMatch(/^\+/);
  });
});
