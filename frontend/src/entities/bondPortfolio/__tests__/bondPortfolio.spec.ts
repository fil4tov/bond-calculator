import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { addBondPurchase, createBond, deletePortfolioBond, getPortfolioBonds } from '../api';
import { portfolioQueryKey, replacePortfolioBond } from '../query';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const activeDto = {
  id: 'bond-1',
  name: 'ОФЗ 26238',
  coupon_amount: '35.40',
  nominal: '1000.00',
  payments_per_year: 2,
  coupon_period_days: 182,
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
    amount: '2655.00', days_until: 99, period_days: 184, elapsed_period_days: 85,
  },
};

describe('bond portfolio API boundary', () => {
  it('adapts the snake_case list DTO to the public camelCase model without losing decimal strings', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeDto] })));

    const items = await getPortfolioBonds();

    expect(items).toEqual([{
      id: 'bond-1',
      name: 'ОФЗ 26238',
      couponAmount: '35.40',
      nominal: '1000.00',
      paymentsPerYear: 2,
      couponPeriodDays: 182,
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
        amount: '2655.00', daysUntil: 99, periodDays: 184, elapsedPeriodDays: 85,
      },
    }]);
  });

  it('keeps portfolio cache keys isolated by current user id', () => {
    const client = new QueryClient();
    client.setQueryData(portfolioQueryKey('user-1'), [{ id: 'private-user-1' }]);

    expect(client.getQueryData(portfolioQueryKey('user-2'))).toBeUndefined();
    expect(portfolioQueryKey('user-1')).not.toEqual(portfolioQueryKey('user-2'));
  });

  it('serializes supplied coupon period days and omits an absent optional period', async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const request = input as Request;
      requests.push({ url: request.url, body: await request.clone().json() });
      return requests.length === 1
        ? jsonResponse(activeDto, 201)
        : jsonResponse({ ...activeDto, total_quantity: 77 }, 201);
    });
    vi.stubGlobal('fetch', fetchMock);

    await createBond({
      name: 'ОФЗ 26238', couponAmount: '35.40', nominal: '1000.00', paymentsPerYear: 2,
      couponPeriodDays: 182,
      placementDate: '2025-05-15', maturityDate: '2041-05-15', amountSpent: '75000.70',
      quantity: 75, purchaseDate: '2026-08-09',
    });
    await createBond({
      name: 'ОФЗ 26238 без периода', couponAmount: '35.40', nominal: '1000.00', paymentsPerYear: 2,
      placementDate: '2025-05-15', maturityDate: '2041-05-15', amountSpent: '75000.70',
      quantity: 75, purchaseDate: '2026-08-09',
    });
    await addBondPurchase('bond-1', { amountSpent: '1000.05', quantity: 2, purchaseDate: '2026-08-09' });

    expect(requests[0]?.body).toMatchObject({ coupon_period_days: 182 });
    expect(requests[0]?.body).toEqual({
      name: 'ОФЗ 26238', coupon_amount: '35.40', nominal: '1000.00', payments_per_year: 2,
      coupon_period_days: 182,
      placement_date: '2025-05-15', maturity_date: '2041-05-15', amount_spent: '75000.70',
      quantity: 75, purchase_date: '2026-08-09',
    });
    expect(requests[1]?.body).not.toHaveProperty('coupon_period_days');
    expect(requests[2]?.body).toEqual({
      amount_spent: '1000.05', quantity: 2, purchase_date: '2026-08-09',
    });
    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/api/portfolio/bonds');
    expect(new URL(requests[2]?.url ?? '').pathname).toBe('/api/portfolio/bonds/bond-1/purchases');
  });

  it('replaces only the matching card when a purchase response updates aggregates', () => {
    const other = { ...activeDto, id: 'bond-2', name: 'Корпоративная' };
    const current = [activeDto, other].map((item) => ({
      id: item.id,
      name: item.name,
      totalQuantity: item.total_quantity,
    }));

    expect(replacePortfolioBond(current, { id: 'bond-1', name: 'ОФЗ 26238', totalQuantity: 77 })).toEqual([
      { id: 'bond-1', name: 'ОФЗ 26238', totalQuantity: 77 },
      { id: 'bond-2', name: 'Корпоративная', totalQuantity: 75 },
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
