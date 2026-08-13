# Portfolio Summary Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the toolbar coupon chip with two responsive full-width portfolio summary cards for open-position value and current-year coupon progress.

**Architecture:** Extend the existing per-bond metrics with current-year paid and current-month coupon income, then adapt the fields through the bond entity. Keep portfolio-wide aggregation and the new visual component local to `PortfolioPage`; reuse exact integer-kopek arithmetic and the existing card market-value fallback.

**Tech Stack:** Python 3.13, FastAPI/Pydantic, React 19, TypeScript 6, SCSS Modules, Vitest/Testing Library, Playwright, pnpm/pytest.

## Global Constraints

- Preserve the Feature-Sliced dependency direction and keep this page-only scenario inside `PortfolioPage`.
- Use the approved two-card layout, fixed green gradient, joined cells, both themes, responsive states, and reduced motion.
- Coupon progress is exactly `34px` high and contains only the left-aligned received/annual-total pair.
- Do not add a database migration or a new endpoint.
- Preserve unrelated working-tree changes.

---

### Task 1: Add calendar-period coupon metrics

**Files:**
- Modify: `backend/tests/test_portfolio_calculations.py`
- Modify: `backend/app/portfolio/calculations.py`
- Modify: `backend/app/portfolio/schemas.py`
- Modify: `backend/app/portfolio/service.py`

**Interfaces:**
- Produces `BondMetrics.calendar_year_paid_coupon_income: Decimal` and `BondMetrics.calendar_month_coupon_income: Decimal`.
- Produces API fields `calendar_year_paid_coupon_income: string` and `calendar_month_coupon_income: string`.

- [ ] Add a failing calculation test with coupons before the year, earlier this year, later this month, and later this year; assert literal annual-paid, annual-total, and current-month amounts.
- [ ] Run `uv run pytest tests/test_portfolio_calculations.py -q` and verify the missing fields fail.
- [ ] Calculate annual-paid using `year start <= coupon_date <= today` and month total using the first/last dates of `today`'s month; expose both in every `BondMetrics` branch and `BondCard` response.
- [ ] Re-run the focused backend tests and relevant API/schema tests.

### Task 2: Adapt and aggregate the summary data

**Files:**
- Modify: `frontend/src/entities/bondPortfolio/types.ts`
- Modify: `frontend/src/entities/bondPortfolio/api.ts`
- Modify: `frontend/src/entities/bondPortfolio/__tests__/bondPortfolio.spec.ts`
- Create: `frontend/src/pages/PortfolioPage/portfolioSummary.ts`
- Create: `frontend/src/pages/PortfolioPage/__tests__/portfolioSummary.spec.ts`

**Interfaces:**
- Adds `calendarYearPaidCouponIncome` and `calendarMonthCouponIncome` to `BondPortfolioItem`.
- Produces `calculatePortfolioSummary(items)` with market value, invested amount, open count, current result, annual received/expected, monthly coupons, progress percent, and year.

- [ ] Write failing adapter and aggregation tests for exact kopecks, closed-position coupon preservation, signed result, zero expected coupons, and unavailable market price.
- [ ] Run the focused Vitest files and verify RED.
- [ ] Add the DTO/type fields and implement aggregation with BigInt kopecks; return null for market/result when any open market price is unavailable.
- [ ] Re-run the focused tests and verify GREEN.

### Task 3: Render the approved two-card summary

**Files:**
- Create: `frontend/src/pages/PortfolioPage/components/PortfolioSummary/PortfolioSummary.tsx`
- Create: `frontend/src/pages/PortfolioPage/components/PortfolioSummary/PortfolioSummary.module.scss`
- Create: `frontend/src/pages/PortfolioPage/components/PortfolioSummary/index.ts`
- Modify: `frontend/src/pages/PortfolioPage/PortfolioPage.tsx`
- Modify: `frontend/src/pages/PortfolioPage/PortfolioPage.module.scss`
- Modify: `frontend/src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx`
- Modify: `frontend/e2e/portfolio.spec.ts`

**Interfaces:**
- `PortfolioSummary({ bonds }: { bonds: readonly BondPortfolioItem[] })` renders both cards and accessible coupon progress.

- [ ] Update component tests first to require the four bond metrics, three coupon metrics, exact tooltip, annual pair, progress ARIA, and absence of the former toolbar coupon chip.
- [ ] Run the PortfolioPage test and verify RED.
- [ ] Implement the component and approved responsive SCSS; keep the progress track/fill geometry aligned with `BondPortfolioCard` and set `min-height`/`height` to `34px`.
- [ ] Place the summary above a sort-only toolbar and remove obsolete coupon-summary calculations/styles.
- [ ] Update fixture fields and E2E expectations, including mobile overflow and the computed `34px` progress height.
- [ ] Run focused component tests, typecheck, lint, and the portfolio E2E scenario; visually inspect light/dark desktop and mobile screenshots.

### Task 4: Final verification

- [ ] Run `uv run pytest tests/test_portfolio_calculations.py tests/test_portfolio_api.py -q` in `backend`.
- [ ] Run focused frontend tests, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
- [ ] Run the portfolio E2E spec if the local Docker/browser environment is available; otherwise report it as not run.
- [ ] Run `git diff --check` and review the final diff without touching unrelated changes.
