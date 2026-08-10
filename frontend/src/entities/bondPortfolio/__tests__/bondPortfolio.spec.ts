import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { addBondPurchase, createBond, deletePortfolioBond, getPortfolioBonds, lookupTInvestBond } from '../api';
import { portfolioQueryKey, replacePortfolioBond, tInvestLookupQueryKey } from '../query';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const activeDto = {
  id: 'bond-1',
  name: 'ОФЗ 26238',
  nominal: '1000.00',
  payments_per_year: 2,
  placement_date: '2025-05-15',
  maturity_date: '2041-05-15',
  status: 'active',
  total_quantity: 75,
  total_spent: '75000.70',
  paid_coupon_total: '1770.00',
  annual_coupon_yield_percent: '7.0800',
  maturity_remaining: { years: 14, months: 9, days_until: 5392 },
  next_coupon: {
    period_start: '2026-05-15', period_end: '2026-11-15', pay_date: '2026-11-16',
    amount: '2655.00', amount_per_bond: '35.40', days_until: 99, period_days: 184, elapsed_period_days: 85,
  },
  purchases: [
    { id: 'purchase-2', amount_spent: '25000.35', quantity: 25, purchase_date: '2026-08-09' },
    { id: 'purchase-1', amount_spent: '50000.35', quantity: 50, purchase_date: '2026-08-08' },
  ],
};

describe('bond portfolio API boundary', () => {
  it('adapts the portfolio schedule with the per-bond coupon amount', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeDto] })));

    await expect(getPortfolioBonds()).resolves.toEqual([{
      id: 'bond-1',
      name: 'ОФЗ 26238',
      nominal: '1000.00',
      paymentsPerYear: 2,
      placementDate: '2025-05-15',
      maturityDate: '2041-05-15',
      status: 'active',
      totalQuantity: 75,
      totalSpent: '75000.70',
      paidCouponTotal: '1770.00',
      annualCouponYieldPercent: '7.0800',
      maturityRemaining: { years: 14, months: 9, daysUntil: 5392 },
      nextCoupon: {
        periodStart: '2026-05-15', periodEnd: '2026-11-15', payDate: '2026-11-16',
        amount: '2655.00', amountPerBond: '35.40', daysUntil: 99, periodDays: 184, elapsedPeriodDays: 85,
      },
      purchases: [
        { id: 'purchase-2', amountSpent: '25000.35', quantity: 25, purchaseDate: '2026-08-09' },
        { id: 'purchase-1', amountSpent: '50000.35', quantity: 50, purchaseDate: '2026-08-08' },
      ],
    }]);
  });

  it('looks up a trimmed ticker through the exact T-Invest endpoint and preserves null', async () => {
    const requests: Request[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(input as Request);
      return jsonResponse({ item: null });
    }));

    await expect(lookupTInvestBond('SU26238')).resolves.toBeNull();
    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/api/portfolio/bonds/t-invest-lookup');
    expect(new URL(requests[0]?.url ?? '').searchParams.get('ticker')).toBe('SU26238');
  });

  it('keeps lookup cache keys isolated by user id and ticker', () => {
    const client = new QueryClient();
    client.setQueryData(tInvestLookupQueryKey('user-1', 'SU26238'), { ticker: 'SU26238' });

    expect(client.getQueryData(tInvestLookupQueryKey('user-2', 'SU26238'))).toBeUndefined();
    expect(client.getQueryData(tInvestLookupQueryKey('user-1', 'SU26237'))).toBeUndefined();
  });

  it('serializes the selected instrument without the retired coupon input fields', async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const request = input as Request;
      requests.push({ url: request.url, body: await request.clone().json() });
      return requests.length === 1 ? jsonResponse(activeDto, 201) : jsonResponse({ ...activeDto, total_quantity: 77 }, 201);
    }));

    await createBond({
      instrumentUid: 'instrument-1', ticker: 'SU26238', name: 'ОФЗ 26238', nominal: '1000.00', paymentsPerYear: 2,
      placementDate: '2025-05-15', maturityDate: '2041-05-15', amountSpent: '75000.70', quantity: 75, purchaseDate: '2026-08-09',
    });
    await addBondPurchase('bond-1', { amountSpent: '1000.05', quantity: 2, purchaseDate: '2026-08-09' });

    expect(requests[0]?.body).toEqual({
      instrument_uid: 'instrument-1', ticker: 'SU26238', name: 'ОФЗ 26238', nominal: '1000.00', payments_per_year: 2,
      placement_date: '2025-05-15', maturity_date: '2041-05-15', amount_spent: '75000.70', quantity: 75, purchase_date: '2026-08-09',
    });
    expect(requests[1]?.body).toEqual({ amount_spent: '1000.05', quantity: 2, purchase_date: '2026-08-09' });
  });

  it('keeps portfolio cache keys isolated by current user id', () => {
    const client = new QueryClient();
    client.setQueryData(portfolioQueryKey('user-1'), [{ id: 'private-user-1' }]);
    expect(client.getQueryData(portfolioQueryKey('user-2'))).toBeUndefined();
  });

  it('replaces only the matching card when a purchase response updates aggregates', () => {
    expect(replacePortfolioBond([{ id: 'bond-1', totalQuantity: 75 }, { id: 'bond-2', totalQuantity: 75 }], { id: 'bond-1', totalQuantity: 77 })).toEqual([
      { id: 'bond-1', totalQuantity: 77 }, { id: 'bond-2', totalQuantity: 75 },
    ]);
  });

  it('deletes the selected bond through the exact backend contract', async () => {
    let request: Request | undefined;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      request = input as Request;
      return new Response(null, { status: 204 });
    }));
    await deletePortfolioBond('bond-1');
    expect(request?.method).toBe('DELETE');
    expect(new URL(request?.url ?? '').pathname).toBe('/api/portfolio/bonds/bond-1');
  });
});
