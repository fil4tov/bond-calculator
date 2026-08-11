# Purchase History Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every bond purchase as a newest-first vertical timeline in the bond details modal.

**Architecture:** Extend the existing `BondCard` response with purchase records because purchases are already eagerly loaded for portfolio calculations. Adapt the records into the bond entity on the frontend and render them inside the page-owned `BondDetails` component, so create/add-purchase responses continue updating the complete cached bond object atomically.

**Tech Stack:** FastAPI, Pydantic, SQLAlchemy, React, TypeScript, SCSS Modules, Vitest, Testing Library, Playwright.

## Global Constraints

- Keep the existing layer direction `app → pages → widgets → entities → shared`.
- Sort purchases newest first by `purchase_date`, then `created_at`, then `id`.
- Render amount and quantity on the left and purchase date on the right.
- Reuse the existing modal scroll container; do not add pagination or a nested scrollbar.

---

### Task 1: Extend the portfolio API contract

**Files:**
- Modify: `backend/app/portfolio/schemas.py`
- Modify: `backend/app/portfolio/service.py`
- Test: `backend/tests/test_portfolio_api.py`

**Interfaces:**
- Produces: `BondPurchaseItem(id: UUID, amount_spent: str, quantity: int, purchase_date: date)` and `BondCard.purchases: list[BondPurchaseItem]`.

- [ ] Add a failing API assertion that the card contains all purchases in newest-first order with fixed two-decimal amounts.
- [ ] Run `uv run pytest tests/test_portfolio_api.py -q` from `backend` and confirm the missing `purchases` field fails.
- [ ] Add the response schema and build the sorted purchase list in `build_bond_card`; use `purchase_date`, `created_at`, and `id` as descending keys.
- [ ] Re-run the focused backend test and confirm it passes.

### Task 2: Adapt purchase history on the frontend

**Files:**
- Modify: `frontend/src/entities/bondPortfolio/types.ts`
- Modify: `frontend/src/entities/bondPortfolio/api.ts`
- Test: `frontend/src/entities/bondPortfolio/__tests__/bondPortfolio.spec.ts`

**Interfaces:**
- Consumes: API `purchases[]` from Task 1.
- Produces: `BondPurchaseHistoryItem { id: string; amountSpent: string; quantity: number; purchaseDate: string }` and `BondPortfolioItem.purchases`.

- [ ] Extend the DTO fixture and add failing adapter assertions for all four mapped properties.
- [ ] Run `pnpm test src/entities/bondPortfolio/__tests__/bondPortfolio.spec.ts` and confirm the mapping fails.
- [ ] Add the entity type, DTO field and snake_case-to-camelCase adapter mapping.
- [ ] Re-run the focused entity test and confirm it passes.

### Task 3: Render the vertical timeline

**Files:**
- Modify: `frontend/src/pages/PortfolioPage/components/BondDetails/BondDetails.tsx`
- Modify: `frontend/src/pages/PortfolioPage/components/BondDetails/BondDetails.module.scss`
- Test: `frontend/src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx`

**Interfaces:**
- Consumes: `bond.purchases` from Task 2.

- [ ] Update the portfolio fixture and add a failing component assertion for «История покупок», the localized count, newest-first ordering, amount, quantity and date.
- [ ] Run the focused PortfolioPage test and confirm the timeline is absent.
- [ ] Add a semantic section with an ordered list, decorative `aria-hidden` markers and `<time dateTime={purchase.purchaseDate}>` dates.
- [ ] Add responsive SCSS for the vertical line, markers, two-column purchase rows, numeric typography and both themes using existing CSS variables.
- [ ] Re-run the focused component test and confirm it passes.

### Task 4: Verify the complete flow

**Files:**
- Modify: `frontend/e2e/portfolio.spec.ts`

- [ ] Extend the E2E flow to reopen bond details after adding a purchase and assert two newest-first timeline entries on desktop and mobile.
- [ ] Run backend `uv run pytest`, frontend `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and targeted `pnpm test:e2e portfolio.spec.ts`.
- [ ] Inspect `git diff --check` and confirm no whitespace errors or unrelated edits were introduced by this feature.
