import { apiRequest } from '#shared/api';

import type { AddBondPurchaseInput, AddBondSaleInput, BondOperationType, BondPortfolioItem, BondPortfolioStatus, BondPositionStatus, CreateBondInput, TInvestBondLookup, TInvestBondSearchItem } from './types';

interface BondPortfolioItemDto {
  id: string;
  created_at: string;
  coupon_schedule_updated_at: string;
  name: string;
  nominal: string;
  payments_per_year: number;
  placement_date: string;
  maturity_date: string;
  status: BondPortfolioStatus;
  total_quantity: number;
  total_spent: string;
  position_cost_basis: string;
  market_value_without_aci: string | null;
  accrued_coupon_income: string | null;
  realized_result: string;
  position_status: BondPositionStatus;
  paid_coupon_total: string;
  coupon_payments?: Array<{
    coupon_number: number;
    pay_date: string;
    amount_per_bond: string;
    quantity: number;
    amount: string;
  }>;
  coupon_schedule?: Array<{
    coupon_number: number;
    pay_date: string;
    amount_per_bond: string;
    quantity: number;
    amount: string;
  }>;
  holding_period_coupon_income: string;
  calendar_year_paid_coupon_income: string;
  calendar_year_coupon_yield_percent: string;
  annual_coupon_yield_percent: string | null;
  calendar_year_coupon_income: string;
  calendar_month_coupon_income: string;
  coupon_yield_year: number;
  maturity_remaining: { years: number; months: number; days_until: number };
  next_coupon: {
    period_start: string;
    period_end: string;
    pay_date: string;
    amount: string;
    amount_per_bond: string;
    days_until: number;
    period_days: number;
    elapsed_period_days: number;
  } | null;
  operations: Array<{
    id: string;
    operation_type: BondOperationType;
    amount: string;
    quantity: number;
    operation_date: string;
    realized_result: string | null;
  }>;
}

interface PortfolioListDto { items: BondPortfolioItemDto[] }
interface NameAvailabilityDto { available: boolean }

const adaptBond = (dto: BondPortfolioItemDto): BondPortfolioItem => ({
  id: dto.id,
  createdAt: dto.created_at,
  couponScheduleUpdatedAt: dto.coupon_schedule_updated_at,
  name: dto.name,
  nominal: dto.nominal,
  paymentsPerYear: dto.payments_per_year,
  placementDate: dto.placement_date,
  maturityDate: dto.maturity_date,
  status: dto.status,
  totalQuantity: dto.total_quantity,
  totalSpent: dto.total_spent,
  positionCostBasis: dto.position_cost_basis,
  marketValueWithoutAci: dto.market_value_without_aci,
  accruedCouponIncome: dto.accrued_coupon_income,
  realizedResult: dto.realized_result,
  positionStatus: dto.position_status,
  paidCouponTotal: dto.paid_coupon_total,
  couponPayments: (dto.coupon_payments ?? []).map((payment) => ({
    couponNumber: payment.coupon_number,
    payDate: payment.pay_date,
    amountPerBond: payment.amount_per_bond,
    quantity: payment.quantity,
    amount: payment.amount,
  })),
  couponSchedule: (dto.coupon_schedule ?? []).map((event) => ({
    couponNumber: event.coupon_number,
    payDate: event.pay_date,
    amountPerBond: event.amount_per_bond,
    quantity: event.quantity,
    amount: event.amount,
  })),
  holdingPeriodCouponIncome: dto.holding_period_coupon_income,
  calendarYearPaidCouponIncome: dto.calendar_year_paid_coupon_income,
  calendarYearCouponYieldPercent: dto.calendar_year_coupon_yield_percent,
  annualCouponYieldPercent: dto.annual_coupon_yield_percent,
  calendarYearCouponIncome: dto.calendar_year_coupon_income,
  calendarMonthCouponIncome: dto.calendar_month_coupon_income,
  couponYieldYear: dto.coupon_yield_year,
  maturityRemaining: {
    years: dto.maturity_remaining.years,
    months: dto.maturity_remaining.months,
    daysUntil: dto.maturity_remaining.days_until,
  },
  nextCoupon: dto.next_coupon ? {
    periodStart: dto.next_coupon.period_start,
    periodEnd: dto.next_coupon.period_end,
    payDate: dto.next_coupon.pay_date,
    amount: dto.next_coupon.amount,
    amountPerBond: dto.next_coupon.amount_per_bond,
    daysUntil: dto.next_coupon.days_until,
    periodDays: dto.next_coupon.period_days,
    elapsedPeriodDays: dto.next_coupon.elapsed_period_days,
  } : null,
  operations: dto.operations.map((operation) => ({
    id: operation.id,
    operationType: operation.operation_type,
    amount: operation.amount,
    quantity: operation.quantity,
    operationDate: operation.operation_date,
    realizedResult: operation.realized_result,
  })),
});

export async function getPortfolioBonds(signal?: AbortSignal) {
  const response = await apiRequest<PortfolioListDto>('portfolio/bonds', { signal });
  return response.items.map(adaptBond);
}

export async function checkBondNameAvailability(name: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ name });
  const response = await apiRequest<NameAvailabilityDto>(`portfolio/bonds/name-availability?${params.toString()}`, { signal });
  return response.available;
}

interface TInvestBondLookupDto {
  ticker: string;
  instrument_uid: string;
  name: string;
  nominal: string;
  payments_per_year: number;
  placement_date: string;
  maturity_date: string;
}

interface TInvestBondSearchItemDto {
  ticker: string;
  instrument_uid: string;
  name: string;
}

export async function searchTInvestBonds(query: string, signal?: AbortSignal): Promise<TInvestBondSearchItem[]> {
  const params = new URLSearchParams({ query });
  const response = await apiRequest<{ items: TInvestBondSearchItemDto[] }>(`portfolio/bonds/t-invest-search?${params.toString()}`, { signal });
  return response.items.slice(0, 10).map((item) => ({
    ticker: item.ticker,
    instrumentUid: item.instrument_uid,
    name: item.name,
  }));
}

export async function lookupTInvestBond(instrumentUid: string, signal?: AbortSignal): Promise<TInvestBondLookup | null> {
  const params = new URLSearchParams({ instrument_uid: instrumentUid });
  const response = await apiRequest<{ item: TInvestBondLookupDto | null }>(`portfolio/bonds/t-invest-lookup?${params.toString()}`, { signal });
  if (!response.item) return null;
  return {
    ticker: response.item.ticker,
    instrumentUid: response.item.instrument_uid,
    name: response.item.name,
    nominal: response.item.nominal,
    paymentsPerYear: response.item.payments_per_year,
    placementDate: response.item.placement_date,
    maturityDate: response.item.maturity_date,
  };
}

export async function createBond(input: CreateBondInput) {
  const response = await apiRequest<BondPortfolioItemDto>('portfolio/bonds', {
    method: 'post',
    json: {
      instrument_uid: input.instrumentUid,
      ticker: input.ticker,
      name: input.name,
      nominal: input.nominal,
      payments_per_year: input.paymentsPerYear,
      placement_date: input.placementDate,
      maturity_date: input.maturityDate,
      amount_spent: input.amountSpent,
      quantity: input.quantity,
      purchase_date: input.purchaseDate,
    },
  });
  return adaptBond(response);
}

export async function addBondPurchase(bondId: string, input: AddBondPurchaseInput) {
  const response = await apiRequest<BondPortfolioItemDto>(`portfolio/bonds/${bondId}/purchases`, {
    method: 'post',
    json: {
      amount_spent: input.amountSpent,
      quantity: input.quantity,
      purchase_date: input.purchaseDate,
    },
  });
  return adaptBond(response);
}

export async function addBondSale(bondId: string, input: AddBondSaleInput) {
  const response = await apiRequest<BondPortfolioItemDto>(`portfolio/bonds/${bondId}/sales`, {
    method: 'post',
    json: {
      amount_received: input.amountReceived,
      quantity: input.quantity,
      sale_date: input.saleDate,
    },
  });
  return adaptBond(response);
}

export async function deletePortfolioOperation(bondId: string, operationId: string) {
  const response = await apiRequest<{ item: BondPortfolioItemDto | null }>(
    `portfolio/bonds/${bondId}/operations/${operationId}`,
    { method: 'delete' },
  );
  return response.item ? adaptBond(response.item) : null;
}

export async function deletePortfolioBond(bondId: string) {
  await apiRequest<void>(`portfolio/bonds/${bondId}`, { method: 'delete' });
}

export async function refreshCouponSchedule(bondId: string) {
  const response = await apiRequest<BondPortfolioItemDto>(
    `portfolio/bonds/${bondId}/coupon-schedule/refresh`,
    { method: 'post' },
  );
  return adaptBond(response);
}
