import type { BondCalculationInput, BondCalculationResult, SavedBondCalculationFields } from './types';

export const DAYS_IN_YEAR = 365.2425;
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

const toKopecks = (value: number) => Math.round((value + Number.EPSILON) * 100);

export function calculatePurchasableQuantity(investmentAmount: number, purchasePrice: number) {
  if (!Number.isFinite(investmentAmount) || !Number.isFinite(purchasePrice) || investmentAmount <= 0 || purchasePrice <= 0) {
    return 0;
  }

  return Math.floor(toKopecks(investmentAmount) / toKopecks(purchasePrice));
}

export function calculateInvestmentAmount(purchasePrice: number, quantity: number) {
  if (!Number.isFinite(purchasePrice) || !Number.isInteger(quantity) || quantity < 0) {
    return 0;
  }

  return (toKopecks(purchasePrice) * quantity) / 100;
}

export function calculateInvestmentRemainder(investmentAmount: number, purchasePrice: number, quantity: number) {
  if (!Number.isFinite(investmentAmount) || !Number.isFinite(purchasePrice) || !Number.isInteger(quantity)
    || investmentAmount < 0 || purchasePrice <= 0 || quantity < 0) {
    return null;
  }

  const remainder = toKopecks(investmentAmount) - toKopecks(purchasePrice) * quantity;
  return remainder >= 0 ? remainder / 100 : null;
}

export function calculateBond(input: BondCalculationInput): BondCalculationResult {
  const investment = calculateInvestmentAmount(input.purchasePrice, input.quantity);
  const annualCoupons = input.coupon * input.paymentsPerYear * input.quantity;
  const paymentAmount = input.coupon * input.quantity;
  const priceDifference = (input.exitPrice - input.purchasePrice) * input.quantity;
  const annualIncome = annualCoupons;
  const annualYield = (annualIncome / investment) * 100;
  const couponIncomeTotal = annualCoupons * input.holdingYears;
  const totalProfit = couponIncomeTotal + priceDifference;
  const annualYieldWithPrice = (totalProfit / input.holdingYears / investment) * 100;
  const finalAmount = investment + totalProfit;

  return {
    ...input,
    investment,
    annualCoupons,
    paymentAmount,
    priceDifference,
    annualIncome,
    annualYield,
    couponIncomeTotal,
    totalProfit,
    annualYieldWithPrice,
    finalAmount,
  };
}

export function combineHoldingPeriod(years: number, months: number) {
  return years + months / 12;
}

export function calculateHoldingYearsFromDate(maturityDateValue: string, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const maturityDate = new Date(`${maturityDateValue}T00:00:00`);
  return (maturityDate.getTime() - today.getTime()) / (MILLISECONDS_IN_DAY * DAYS_IN_YEAR);
}

export function calculatePresetYields(fields: SavedBondCalculationFields, now = new Date()) {
  const holdingYears = fields.holdToMaturity === 'yes'
    ? calculateHoldingYearsFromDate(fields.maturityDate, now)
    : combineHoldingPeriod(fields.holdingYears, fields.holdingMonths);
  const exitPrice = fields.holdToMaturity === 'yes' ? fields.nominal : fields.salePrice;

  const valid = Number.isFinite(fields.nominal) && fields.nominal > 0
    && Number.isFinite(fields.purchasePrice) && fields.purchasePrice > 0
    && Number.isInteger(fields.quantity) && fields.quantity > 0
    && Number.isFinite(fields.coupon) && fields.coupon >= 0
    && Number.isInteger(fields.paymentsPerYear) && fields.paymentsPerYear > 0
    && Number.isFinite(holdingYears) && holdingYears > 0
    && Number.isFinite(exitPrice) && exitPrice > 0;

  if (!valid) return null;
  const result = calculateBond({
    nominal: fields.nominal,
    purchasePrice: fields.purchasePrice,
    quantity: fields.quantity,
    coupon: fields.coupon,
    paymentsPerYear: fields.paymentsPerYear,
    holdingYears,
    exitPrice,
  });

  return Number.isFinite(result.annualYield) && Number.isFinite(result.annualYieldWithPrice)
    ? { annualYield: result.annualYield, annualYieldWithPrice: result.annualYieldWithPrice }
    : null;
}
