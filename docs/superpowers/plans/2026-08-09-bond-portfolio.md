# Bond Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a personal bond portfolio backed by PostgreSQL with aggregate bond cards, atomic bond/purchase creation, and purchase additions.

**Architecture:** Two normalized user-owned tables feed backend-owned financial calculations. FastAPI exposes authenticated portfolio endpoints; the React page consumes them through a Feature-Sliced entity and TanStack Query.

**Tech Stack:** Python 3.13, FastAPI, SQLAlchemy async, Alembic, PostgreSQL 17, React 19, TypeScript, React Hook Form, TanStack Query, SCSS Modules, Vitest, Playwright.

## Global Constraints

- Preserve `app -> pages -> widgets -> entities -> shared`; do not create `features` or a root store.
- Money is exact to two decimal places in PostgreSQL and backend `Decimal`; JSON money values are decimal strings.
- Portfolio data is private to the current HttpOnly session user and responses use `Cache-Control: no-store`.
- Coupon schedules are regular calendar-month schedules anchored at maturity; allowed frequencies are `1, 2, 3, 4, 6, 12`.
- V1 supports create bond with first purchase and add purchase only: no edit, delete, sale, tax, amortization, variable coupon, or irregular schedule.
- Follow strict test-first red/green/refactor and preserve both themes, responsive states, accessibility, and reduced motion.

---

### Task 1: Portfolio backend

- [ ] Add reusable current-user auth dependency.
- [ ] Add `bonds` and `bond_purchases` ORM models plus additive Alembic migration.
- [ ] Add pure calendar/aggregate calculations with injected `today`.
- [ ] Add authenticated list, create, name-availability, and add-purchase endpoints.
- [ ] Add backend unit/integration tests and keep existing auth contract green.

### Task 2: Portfolio frontend

- [ ] Produce a compact design direction consistent with the existing calculator and header.
- [ ] Add `entities/bondPortfolio` public API, DTO adapters, and TanStack Query integration.
- [ ] Replace portfolio empty placeholder with loading/error/empty/list states and vertical cards.
- [ ] Add accessible create-bond and add-purchase modal forms with live name availability.
- [ ] Add component/unit/E2E coverage and keep existing calculator/auth behavior green.

### Integration and verification

- [ ] Cross-review backend/frontend contract and resolve discrepancies.
- [ ] Run backend pytest, frontend lint/typecheck/test/build, Compose config/migration checks, and real-stack E2E when Docker is available.
