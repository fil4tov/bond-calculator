import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { addBondPurchase, addBondSale, createBond, deletePortfolioBond, deletePortfolioOperation, getPortfolioBonds, lookupTInvestBond, searchTInvestBonds } from '../api';
import { portfolioQueryKey, replacePortfolioBond, tInvestLookupQueryKey, tInvestSearchQueryKey } from '../query';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const activeDto = {
  id: 'bond-1',
  created_at: '2026-08-08T10:15:30+00:00',
  name: 'ОФЗ 26238',
  nominal: '1000.00',
  payments_per_year: 2,
  placement_date: '2025-05-15',
  maturity_date: '2041-05-15',
  status: 'active',
  total_quantity: 75,
  total_spent: '75000.70',
  position_cost_basis: '75000.70',
  market_value_without_aci: '74250.00',
  accrued_coupon_income: '925.93',
  realized_result: '1250.30',
  position_status: 'open',
  paid_coupon_total: '1770.00',
  holding_period_coupon_income: '28500.00',
  calendar_year_paid_coupon_income: '1770.00',
  calendar_year_coupon_yield_percent: '7.0800',
  annual_coupon_yield_percent: '14.0070',
  calendar_year_coupon_income: '4248.00',
  calendar_month_coupon_income: '0.00',
  coupon_yield_year: 2026,
  maturity_remaining: { years: 14, months: 9, days_until: 5392 },
  next_coupon: {
    period_start: '2026-05-15', period_end: '2026-11-15', pay_date: '2026-11-16',
    amount: '2655.00', amount_per_bond: '35.40', days_until: 99, period_days: 184, elapsed_period_days: 85,
  },
  operations: [
    { id: 'sale-1', operation_type: 'sale', amount: '26000.00', quantity: 25, operation_date: '2026-08-10', realized_result: '999.65' },
    { id: 'purchase-2', operation_type: 'purchase', amount: '25000.35', quantity: 25, operation_date: '2026-08-09', realized_result: null },
    { id: 'purchase-1', operation_type: 'purchase', amount: '50000.35', quantity: 50, operation_date: '2026-08-08', realized_result: null },
  ],
};

describe('bond portfolio API boundary', () => {
  it('adapts the portfolio schedule with the per-bond coupon amount', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [activeDto] })));

    await expect(getPortfolioBonds()).resolves.toEqual([{
      id: 'bond-1',
      createdAt: '2026-08-08T10:15:30+00:00',
      name: 'ОФЗ 26238',
      nominal: '1000.00',
      paymentsPerYear: 2,
      placementDate: '2025-05-15',
      maturityDate: '2041-05-15',
      status: 'active',
      totalQuantity: 75,
      totalSpent: '75000.70',
      positionCostBasis: '75000.70',
      marketValueWithoutAci: '74250.00',
      accruedCouponIncome: '925.93',
      realizedResult: '1250.30',
      positionStatus: 'open',
      paidCouponTotal: '1770.00',
      holdingPeriodCouponIncome: '28500.00',
      calendarYearPaidCouponIncome: '1770.00',
      calendarYearCouponYieldPercent: '7.0800',
      annualCouponYieldPercent: '14.0070',
      calendarYearCouponIncome: '4248.00',
      calendarMonthCouponIncome: '0.00',
      couponYieldYear: 2026,
      maturityRemaining: { years: 14, months: 9, daysUntil: 5392 },
      nextCoupon: {
        periodStart: '2026-05-15', periodEnd: '2026-11-15', payDate: '2026-11-16',
        amount: '2655.00', amountPerBond: '35.40', daysUntil: 99, periodDays: 184, elapsedPeriodDays: 85,
      },
      operations: [
        { id: 'sale-1', operationType: 'sale', amount: '26000.00', quantity: 25, operationDate: '2026-08-10', realizedResult: '999.65' },
        { id: 'purchase-2', operationType: 'purchase', amount: '25000.35', quantity: 25, operationDate: '2026-08-09', realizedResult: null },
        { id: 'purchase-1', operationType: 'purchase', amount: '50000.35', quantity: 50, operationDate: '2026-08-08', realizedResult: null },
      ],
    }]);
  });

  it('searches by name through the search endpoint and adapts multiple results', async () => {
    const requests: Request[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(input as Request);
      return jsonResponse({ items: [
        { ticker: 'SU26238', instrument_uid: 'uid-1', name: 'ОФЗ 26238' },
        { ticker: 'SU26240', instrument_uid: 'uid-2', name: 'ОФЗ 26240' },
      ] });
    }));

    await expect(searchTInvestBonds('ОФЗ')).resolves.toEqual([
      { ticker: 'SU26238', instrumentUid: 'uid-1', name: 'ОФЗ 26238' },
      { ticker: 'SU26240', instrumentUid: 'uid-2', name: 'ОФЗ 26240' },
    ]);
    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/api/portfolio/bonds/t-invest-search');
    expect(new URL(requests[0]?.url ?? '').searchParams.get('query')).toBe('ОФЗ');
  });

  it('looks up full bond details by UID and preserves null', async () => {
    const requests: Request[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requests.push(input as Request);
      return jsonResponse({ item: null });
    }));

    await expect(lookupTInvestBond('instrument-1')).resolves.toBeNull();
    expect(new URL(requests[0]?.url ?? '').pathname).toBe('/api/portfolio/bonds/t-invest-lookup');
    expect(new URL(requests[0]?.url ?? '').searchParams.get('instrument_uid')).toBe('instrument-1');
  });

  it('keeps search and lookup cache keys isolated by user and input', () => {
    const client = new QueryClient();
    client.setQueryData(tInvestSearchQueryKey('user-1', 'ОФЗ'), [{ ticker: 'SU26238' }]);
    client.setQueryData(tInvestLookupQueryKey('user-1', 'uid-1'), { ticker: 'SU26238' });

    expect(client.getQueryData(tInvestSearchQueryKey('user-2', 'ОФЗ'))).toBeUndefined();
    expect(client.getQueryData(tInvestSearchQueryKey('user-1', 'ОФЗ-ПД'))).toBeUndefined();
    expect(client.getQueryData(tInvestLookupQueryKey('user-2', 'uid-1'))).toBeUndefined();
    expect(client.getQueryData(tInvestLookupQueryKey('user-1', 'uid-2'))).toBeUndefined();
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

  it('serializes a sale with complete proceeds and adapts the updated position', async () => {
    let request: Request | undefined;
    let body: unknown;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      request = input as Request;
      body = await request.clone().json();
      return jsonResponse({ ...activeDto, total_quantity: 50, position_cost_basis: '50000.70', realized_result: '999.65' }, 201);
    }));

    await expect(addBondSale('bond-1', {
      amountReceived: '26000.00', quantity: 25, saleDate: '2026-08-10',
    })).resolves.toMatchObject({ totalQuantity: 50, positionCostBasis: '50000.70', realizedResult: '999.65' });
    expect(request?.method).toBe('POST');
    expect(new URL(request?.url ?? '').pathname).toBe('/api/portfolio/bonds/bond-1/sales');
    expect(body).toEqual({
      amount_received: '26000.00', quantity: 25, sale_date: '2026-08-10',
    });
  });

  it('deletes one ledger operation and exposes the nullable updated card', async () => {
    let request: Request | undefined;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      request = input as Request;
      return jsonResponse({ item: null });
    }));

    await expect(deletePortfolioOperation('bond-1', 'sale-1')).resolves.toBeNull();
    expect(request?.method).toBe('DELETE');
    expect(new URL(request?.url ?? '').pathname).toBe('/api/portfolio/bonds/bond-1/operations/sale-1');
  });
});
