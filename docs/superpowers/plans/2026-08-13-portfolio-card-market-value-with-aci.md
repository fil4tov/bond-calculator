# Portfolio Card Market Value With ACI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the bond card's current market value including accrued coupon income, with the exact tooltip text «Текущая рыночная стоимость + НКД».

**Architecture:** Keep the calculation in the `PortfolioPage` slice. Extract the modal's exact decimal addition and open-position fallback behavior into one pure utility consumed by both `BondPortfolioCard` and `BondDetails`, then update component and E2E expectations.

**Tech Stack:** React 19, TypeScript 6, Vitest, Testing Library, Playwright, pnpm.

## Global Constraints

- The card displays one total only; it does not display a market-value/ACI breakdown.
- Add ACI only when `positionStatus === 'open'`.
- If ACI is unavailable, fall back to `marketValueWithoutAci`; if market value is unavailable, return `null` and render `—`.
- Tooltip copy must be exactly `Текущая рыночная стоимость + НКД`.
- Portfolio sorting remains based on `marketValueWithoutAci`.
- Keep all new code within the `PortfolioPage` slice and use relative imports inside the slice.

---

### Task 1: Share the full market-value calculation and render it in the card

**Files:**
- Modify: `frontend/src/pages/PortfolioPage/__tests__/utils.spec.ts`
- Modify: `frontend/src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx`
- Modify: `frontend/e2e/portfolio.spec.ts`
- Modify: `frontend/src/pages/PortfolioPage/utils.ts`
- Modify: `frontend/src/pages/PortfolioPage/components/BondPortfolioCard/BondPortfolioCard.tsx`
- Modify: `frontend/src/pages/PortfolioPage/components/BondDetails/BondDetails.tsx`

**Interfaces:**
- Consumes: `BondPortfolioItem.marketValueWithoutAci`, `BondPortfolioItem.accruedCouponIncome`, and `BondPortfolioItem.positionStatus`.
- Produces: `currentMarketValue(bond: Pick<BondPortfolioItem, 'marketValueWithoutAci' | 'accruedCouponIncome' | 'positionStatus'>): string | null` from `PortfolioPage/utils.ts`.

- [ ] **Step 1: Write failing utility and component tests**

Add utility assertions that define exact addition and fallback behavior:

```ts
expect(currentMarketValue({
  marketValueWithoutAci: '74250.00',
  accruedCouponIncome: '925.93',
  positionStatus: 'open',
})).toBe('75175.93');
expect(currentMarketValue({
  marketValueWithoutAci: '74250.00',
  accruedCouponIncome: null,
  positionStatus: 'open',
})).toBe('74250.00');
expect(currentMarketValue({
  marketValueWithoutAci: '74250.00',
  accruedCouponIncome: '925.93',
  positionStatus: 'closed',
})).toBe('74250.00');
expect(currentMarketValue({
  marketValueWithoutAci: null,
  accruedCouponIncome: '925.93',
  positionStatus: 'open',
})).toBeNull();
```

In the compact-card test, replace the expected `74.250,00 ₽` with `75.175,93 ₽`, assert that `74.250,00 ₽ + 925,93 ₽ НКД` is absent from the card, and assert the tooltip button/content use the exact text `Текущая рыночная стоимость + НКД`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm test -- src/pages/PortfolioPage/__tests__/utils.spec.ts src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx
```

Expected: FAIL because `currentMarketValue` is not exported and the card still renders `74.250,00 ₽` with the old tooltip copy.

- [ ] **Step 3: Implement the shared pure utility**

In `PortfolioPage/utils.ts`, import the entity type and add the exact decimal helper and exported selector:

```ts
import type { BondPortfolioItem } from '#entities/bondPortfolio';

function addMoneyValues(left: string, right: string) {
  const toKopecks = (value: string) => {
    const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match) throw new Error('Expected a plain money value');
    const amount = BigInt(match[2]!) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'));
    return match[1] ? -amount : amount;
  };
  const total = toKopecks(left) + toKopecks(right);
  const absolute = total < 0n ? -total : total;
  return `${total < 0n ? '-' : ''}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

export function currentMarketValue(
  bond: Pick<BondPortfolioItem, 'marketValueWithoutAci' | 'accruedCouponIncome' | 'positionStatus'>,
) {
  if (bond.marketValueWithoutAci === null) return null;
  if (bond.positionStatus !== 'open' || bond.accruedCouponIncome === null) {
    return bond.marketValueWithoutAci;
  }
  return addMoneyValues(bond.marketValueWithoutAci, bond.accruedCouponIncome);
}
```

- [ ] **Step 4: Use the utility in both views and update the tooltip**

In `BondPortfolioCard.tsx`, compute `const marketValue = currentMarketValue(bond)`, render it through `formatMoney`, remove the old `marketValueWithoutAciDescription` usage, and set both the tooltip accessible label and content to `Текущая рыночная стоимость + НКД`.

In `BondDetails.tsx`, remove the component-local `addMoneyValues` function and replace its `currentAci`/`totalMarketValue` calculation with `const totalMarketValue = currentMarketValue(bond)`. Keep the existing breakdown condition and markup unchanged.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
pnpm test -- src/pages/PortfolioPage/__tests__/utils.spec.ts src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx
```

Expected: both test files PASS with no warnings.

- [ ] **Step 6: Update and run the E2E expectation**

In `frontend/e2e/portfolio.spec.ts`, change the card tooltip accessible name/content to `Текущая рыночная стоимость + НКД` and assert the card contains `10 025,00 ₽` for the fixture whose base market value is `10 000,00 ₽` and ACI is `25,00 ₽`.

Run:

```bash
pnpm test:e2e -- e2e/portfolio.spec.ts
```

Expected: portfolio E2E scenarios PASS.

- [ ] **Step 7: Run the project verification suite**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Expected: every command exits successfully with no lint errors, type errors, test failures, or build failures.

- [ ] **Step 8: Commit the implementation**

```bash
git add frontend/src/pages/PortfolioPage/utils.ts frontend/src/pages/PortfolioPage/__tests__/utils.spec.ts frontend/src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx frontend/src/pages/PortfolioPage/components/BondPortfolioCard/BondPortfolioCard.tsx frontend/src/pages/PortfolioPage/components/BondDetails/BondDetails.tsx frontend/e2e/portfolio.spec.ts docs/superpowers/plans/2026-08-13-portfolio-card-market-value-with-aci.md
git commit -m "feat(portfolio): include ACI in card market value"
```
