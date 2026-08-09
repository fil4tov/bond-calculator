import { apiRequest } from '#shared/api';

import type { AddBondPurchaseInput, BondPortfolioItem, BondPortfolioStatus, CreateBondInput } from './types';

interface BondPortfolioItemDto {
  id: string;
  name: string;
  coupon_amount: string;
  nominal: string;
  payments_per_year: number;
  coupon_period_days: number;
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
    days_until: number;
    period_days: number;
    elapsed_period_days: number;
  } | null;
}

interface PortfolioListDto { items: BondPortfolioItemDto[] }
interface NameAvailabilityDto { available: boolean }

const adaptBond = (dto: BondPortfolioItemDto): BondPortfolioItem => ({
  id: dto.id,
  name: dto.name,
  couponAmount: dto.coupon_amount,
  nominal: dto.nominal,
  paymentsPerYear: dto.payments_per_year,
  couponPeriodDays: dto.coupon_period_days,
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
    daysUntil: dto.next_coupon.days_until,
    periodDays: dto.next_coupon.period_days,
    elapsedPeriodDays: dto.next_coupon.elapsed_period_days,
  } : null,
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

export async function createBond(input: CreateBondInput) {
  const response = await apiRequest<BondPortfolioItemDto>('portfolio/bonds', {
    method: 'post',
    json: {
      name: input.name,
      coupon_amount: input.couponAmount,
      nominal: input.nominal,
      payments_per_year: input.paymentsPerYear,
      ...(input.couponPeriodDays === undefined
        ? {}
        : { coupon_period_days: input.couponPeriodDays }),
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
