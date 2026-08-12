# Annualized Portfolio Coupon Yield Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current-calendar-year total coupon yield with the calculator-equivalent annualized coupon yield based on the nearest eligible coupon.

**Architecture:** Keep the calculation in the backend portfolio domain and expose one nullable decimal string through `BondCard`. The frontend only adapts, formats, and explains the value; existing calendar-year coupon income and per-event yield remain unchanged.

**Tech Stack:** Python, FastAPI/Pydantic, SQLAlchemy, Decimal, pytest, React, TypeScript, Vitest/Testing Library, Playwright.

## Global Constraints

- Formula: nearest eligible coupon per bond × payments per year × current quantity ÷ remaining position cost basis × 100%.
- Backend rounding is `ROUND_HALF_UP` to four decimal places.
- Return `null` for a closed/zero-cost position, no eligible positive future coupon, or zero payment frequency.
- Label: «Годовая купонная доходность».
- Tooltip: «Показывает, какую купонную доходность принесла бы облигация за полный год, если размер ближайшего купона не изменится».
- Keep calendar-year coupon income and individual-coupon yield behavior unchanged.
- Do not add routes, database columns, migrations, or dependencies.

---

### Task 1: Backend annualized yield calculation and API contract

**Files:**
- Modify: `backend/app/portfolio/calculations.py`
- Modify: `backend/app/portfolio/service.py`
- Modify: `backend/app/portfolio/schemas.py`
- Test: `backend/tests/test_portfolio_calculations.py`
- Test: `backend/tests/test_portfolio_api.py`
- Test: `backend/tests/test_portfolio_operations.py`
- Test: `backend/tests/test_t_invest_portfolio.py`

**Interfaces:**
- `calculate_bond_metrics(..., payments_per_year: int, ...) -> BondMetrics`
- `BondMetrics.annual_coupon_yield_percent: Decimal | None`
- `BondCard.annual_coupon_yield_percent: str | None`

- [ ] **Step 1: Replace the calendar-total-yield tests with failing annualized-yield cases**

Add a calculator-parity case and edge cases:

```python
metrics = calculate_bond_metrics(
    maturity_date=date(2028, 6, 22),
    payments_per_year=12,
    purchases=(PurchasePosition(Decimal("199957.00"), 200, date(2026, 7, 10)),),
    coupons=(coupon(
        coupon_date=date(2026, 9, 1),
        amount="11.67",
        start=date(2026, 8, 1),
        end=date(2026, 8, 31),
    ),),
    today=date(2026, 8, 12),
)
assert metrics.annual_coupon_yield_percent == Decimal("14.0070")
```

Also assert `None` when `payments_per_year == 0`, when the schedule has no eligible positive future coupon, and after the position is fully sold. Keep a partial-sale case proving the numerator uses current quantity and the denominator uses current remaining cost basis.

- [ ] **Step 2: Run the focused calculation tests and confirm RED**

Run from `backend`:

```powershell
uv run pytest tests/test_portfolio_calculations.py -q
```

Expected: failures for the missing `payments_per_year` argument/field and old `calendar_year_total_coupon_yield_percent` behavior.

- [ ] **Step 3: Implement the annualized metric**

In `calculate_bond_metrics`, select `next_coupon` before constructing the result and calculate under the existing 48-digit decimal context:

```python
annual_coupon_yield_percent = (
    (
        next_coupon.pay_one_bond_amount
        * Decimal(payments_per_year)
        * Decimal(total_quantity)
        / position_cost_basis
        * Decimal("100")
    ).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    if next_coupon is not None
    and payments_per_year > 0
    and total_quantity > 0
    and position_cost_basis != 0
    else None
)
```

Rename the dataclass field to `annual_coupon_yield_percent` and construct `BondMetrics` with keyword arguments in both return paths to avoid positional-field mistakes. Do not change `calendar_year_coupon_income` or `calendar_year_coupon_yield_percent`.

- [ ] **Step 4: Wire the backend contract**

Pass `bond.payments_per_year` from `build_bond_card`, replace the Pydantic field with:

```python
annual_coupon_yield_percent: str | None
```

Serialize it with `_fixed_decimal(value, 4)` when non-null. Update exact API expectations for list/create, sale, and delete-operation responses to use `annual_coupon_yield_percent`; remove expectations for the superseded uncommitted field.

- [ ] **Step 5: Run backend portfolio tests and confirm GREEN**

Run from `backend`:

```powershell
uv run pytest tests/test_portfolio_calculations.py tests/test_portfolio_api.py tests/test_portfolio_operations.py tests/test_t_invest_portfolio.py -q
```

Expected: all selected tests pass.

### Task 2: Frontend contract, copy, and modal rendering

**Files:**
- Modify: `frontend/src/entities/bondPortfolio/types.ts`
- Modify: `frontend/src/entities/bondPortfolio/api.ts`
- Modify: `frontend/src/entities/bondPortfolio/__tests__/bondPortfolio.spec.ts`
- Modify: `frontend/src/pages/PortfolioPage/utils.ts`
- Modify: `frontend/src/pages/PortfolioPage/components/BondDetails/BondDetails.tsx`
- Modify: `frontend/src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx`
- Modify: `frontend/src/pages/PortfolioPage/__tests__/sorting.spec.ts`

**Interfaces:**
- DTO: `annual_coupon_yield_percent: string | null`
- Entity: `annualCouponYieldPercent: string | null`
- Copy helper: `annualCouponYieldDescription(): string`

- [ ] **Step 1: Write failing adapter and component assertions**

Update the adapter fixture to expect:

```ts
annualCouponYieldPercent: '14.0070'
```

In the portfolio component test, require the unchanged eight-cell order with the sixth label changed to `Годовая купонная доходность`, require `14,01 %`, and require the approved tooltip text. Change the null test to send `annual_coupon_yield_percent: null` and assert an em dash.

- [ ] **Step 2: Run focused frontend tests and confirm RED**

Run from `frontend`:

```powershell
pnpm.cmd test -- src/entities/bondPortfolio/__tests__/bondPortfolio.spec.ts src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx
```

Expected: failures because the DTO/entity property and UI copy still use the calendar-total field.

- [ ] **Step 3: Rename the frontend field and update the modal**

Replace `calendarYearTotalCouponYieldPercent`/`calendar_year_total_coupon_yield_percent` with `annualCouponYieldPercent`/`annual_coupon_yield_percent` in the entity, DTO, adapter, fixtures, and sorting-test builders.

Replace the sixth metric with:

```tsx
<span>Годовая купонная доходность</span>
<Tooltip label="Как рассчитывается годовая купонная доходность" align="right">
  {annualCouponYieldDescription()}
</Tooltip>
```

Render `—` for `null`; otherwise continue using `formatPercent`. Replace the old year-dependent helper with:

```ts
export function annualCouponYieldDescription() {
  return 'Показывает, какую купонную доходность принесла бы облигация за полный год, если размер ближайшего купона не изменится';
}
```

- [ ] **Step 4: Run frontend unit/component tests and confirm GREEN**

Run from `frontend`:

```powershell
pnpm.cmd test -- src/entities/bondPortfolio/__tests__/bondPortfolio.spec.ts src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx
```

Expected: all frontend tests pass, including null rendering and tooltip copy.

### Task 3: End-to-end acceptance and full verification

**Files:**
- Modify: `frontend/e2e/portfolio.spec.ts`

**Interfaces:**
- Public UI label: `Годовая купонная доходность`
- Public API field consumed by the E2E fixture: `annual_coupon_yield_percent`

- [ ] **Step 1: Update the E2E fixture and assertions**

Return `annual_coupon_yield_percent: '14.0070'` for the representative bond. Assert that the details modal contains `Годовая купонная доходность` and `14,01 %`, while `Ожидаемый купонный доход за {year}` and `Доходность отдельных купонов за {year}` still appear. Keep the existing desktop/mobile grid and overflow assertions.

- [ ] **Step 2: Run E2E and full backend/frontend verification**

Run:

```powershell
Set-Location backend
uv run pytest -q
Set-Location ../frontend
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd test:e2e
pnpm.cmd build
```

Expected: all commands exit with code 0.

- [ ] **Step 3: Review the complete diff**

Run from the repository root:

```powershell
git diff --check
git status --short
```

Confirm there are no stale references to `calendar_year_total_coupon_yield_percent`, `calendarYearTotalCouponYieldPercent`, or the old «Общая купонная доходность за {год}» label.

- [ ] **Step 4: Commit the verified implementation**

Stage the already related accrued-coupon/coupon-metrics work plus this correction, excluding unrelated files, and commit:

```powershell
git commit -m "feat: add annualized portfolio coupon metrics"
```
