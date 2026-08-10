import { apiRequest } from '#shared/api';

import type { AddBondPurchaseInput, BondPortfolioItem, BondPortfolioStatus, CreateBondInput, TInvestBondLookup } from './types';

interface BondPortfolioItemDto {
  id: string;
  name: string;
  nominal: string;
  payments_per_year: number;
  placement_date: string;
  maturity_date: string;
  status: BondPortfolioStatus;
  total_quantity: number;
  total_spent: string;
  paid_coupon_total: string;
  annual_coupon_yield_percent: string;
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
  purchases: Array<{
    id: string;
    amount_spent: string;
    quantity: number;
    purchase_date: string;
  }>;
}

interface PortfolioListDto { items: BondPortfolioItemDto[] }
interface NameAvailabilityDto { available: boolean }

const adaptBond = (dto: BondPortfolioItemDto): BondPortfolioItem => ({
  id: dto.id,
  name: dto.name,
  nominal: dto.nominal,
  paymentsPerYear: dto.payments_per_year,
  placementDate: dto.placement_date,
  maturityDate: dto.maturity_date,
  status: dto.status,
  totalQuantity: dto.total_quantity,
  totalSpent: dto.total_spent,
  paidCouponTotal: dto.paid_coupon_total,
  annualCouponYieldPercent: dto.annual_coupon_yield_percent,
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
  purchases: dto.purchases.map((purchase) => ({
    id: purchase.id,
    amountSpent: purchase.amount_spent,
    quantity: purchase.quantity,
    purchaseDate: purchase.purchase_date,
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

export async function lookupTInvestBond(ticker: string, signal?: AbortSignal): Promise<TInvestBondLookup | null> {
  const params = new URLSearchParams({ ticker });
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

export async function deletePortfolioBond(bondId: string) {
  await apiRequest<void>(`portfolio/bonds/${bondId}`, { method: 'delete' });
}
