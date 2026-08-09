# Fixed-Day Coupon Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace calendar-month coupon boundaries with MOEX-compatible fixed-day periods anchored at maturity, while supporting an inferred or manually supplied coupon period.

**Architecture:** The backend remains the sole owner of schedule construction. It resolves and persists `coupon_period_days`, calculates the expected period count from lifetime and annual frequency, and computes any period by index backwards from maturity without materializing the schedule. The frontend only edits, serializes, and displays the resolved period; all progress, eligibility, paid-coupon, and status calculations continue to use backend response fields.

**Tech Stack:** Python 3.13, FastAPI, Pydantic 2, async SQLAlchemy 2, Alembic, PostgreSQL 17, pytest; React 19, TypeScript 6, React Hook Form, TanStack Query, Vitest, Playwright.

## Global Constraints

- Supported annual frequencies remain exactly `1 | 2 | 3 | 4 | 6 | 12`.
- Default fixed-day mapping is `1→365`, `2→182`, `3→122`, `4→91`, `6→61`, `12→30`.
- Manual `coupon_period_days` is an integer in `1…366`; the API field is optional on create but every persisted bond stores a resolved non-null value.
- Period count uses `ROUND_HALF_UP((maturity - placement).days * payments_per_year / 365)` with a minimum of one.
- Regular periods are anchored backwards from `maturity_date`; only the first period starts at `placement_date` and may be irregular.
- `pay_date`, purchase eligibility, paid totals, progress, and statuses retain their current semantics.
- Do not create a coupon-period table or import a complete MOEX schedule.
- Do not delete existing bonds or purchases during migration.
- Preserve O(log N) lookup around the requested range; do not materialize a lifetime schedule in card calculation.
- Follow `app → pages → widgets → entities → shared`; no `features` layer and no business logic in `shared`.

---

## File Map

- `backend/app/portfolio/calculations.py`: default period mapping, period-count arithmetic, fixed-day indexed boundaries, and aggregate metrics.
- `backend/app/portfolio/models.py`: persisted `coupon_period_days` column and DB check.
- `backend/app/portfolio/schemas.py`: optional create input, resolved validation, and card output.
- `backend/app/portfolio/service.py`: persist and expose the resolved period and pass it into calculations.
- `backend/migrations/versions/20260810_0004_add_coupon_period_days.py`: non-destructive backfill migration.
- `backend/tests/test_portfolio_calculations.py`: exchange-derived schedule and regression coverage.
- `backend/tests/test_portfolio_api.py`: request/response contract and validation errors.
- `backend/tests/test_portfolio_persistence.py`: model constraint and persisted value.
- `backend/tests/test_coupon_period_migration.py`: exact migration order and backfill SQL.
- `frontend/src/entities/bondPortfolio/types.ts`: public camelCase period fields.
- `frontend/src/entities/bondPortfolio/api.ts`: snake_case DTO and create serialization.
- `frontend/src/entities/bondPortfolio/__tests__/bondPortfolio.spec.ts`: transport boundary tests.
- `frontend/src/pages/PortfolioPage/components/PortfolioForms/CreateBondForm.tsx`: inferred default, manual override, validation, and server error mapping.
- `frontend/src/pages/PortfolioPage/components/BondDetails/BondDetails.tsx`: resolved period display.
- `frontend/src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx`: form and detail behavior.
- `frontend/e2e/portfolio.spec.ts`: real create flow using the resolved 30-day period.
- `README.md`: explain the new period model and migration behavior.

---

### Task 1: Fixed-Day Indexed Schedule Engine

**Files:**
- Modify: `backend/tests/test_portfolio_calculations.py`
- Modify: `backend/app/portfolio/calculations.py`

**Interfaces:**
- Produces: `DEFAULT_COUPON_PERIOD_DAYS: dict[int, int]`.
- Produces: `infer_coupon_period_days(payments_per_year: int) -> int`.
- Changes: `calculate_bond_metrics(..., coupon_period_days: int, ...) -> BondMetrics`.
- Changes internal indexed helpers to accept `coupon_period_days: int`.
- Preserves: `CouponPeriod`, `PurchasePosition`, `BondMetrics`, `coupon_dates_between` and existing payment semantics.

- [ ] **Step 1: Add failing tests for the default mapping and supplied MOEX schedules**

Add focused tests that assert the public inference function and indexed boundaries:

```python
@pytest.mark.parametrize(
    ("frequency", "expected_days"),
    [(1, 365), (2, 182), (3, 122), (4, 91), (6, 61), (12, 30)],
)
def test_coupon_period_days_are_inferred_from_frequency(
    frequency: int, expected_days: int
) -> None:
    assert infer_coupon_period_days(frequency) == expected_days


def test_monthly_moex_schedule_uses_continuous_30_day_periods() -> None:
    count = _period_count(
        placement_date=date(2025, 9, 12),
        maturity_date=date(2028, 8, 27),
        payments_per_year=12,
    )
    first = _period_at(
        placement_date=date(2025, 9, 12),
        maturity_date=date(2028, 8, 27),
        payments_per_year=12,
        coupon_period_days=30,
        index=0,
        period_count=count,
    )
    second = _period_at(
        placement_date=date(2025, 9, 12),
        maturity_date=date(2028, 8, 27),
        payments_per_year=12,
        coupon_period_days=30,
        index=1,
        period_count=count,
    )
    assert count == 36
    assert (first.start, first.end) == (date(2025, 9, 12), date(2025, 10, 12))
    assert (second.start, second.end) == (date(2025, 10, 12), date(2025, 11, 11))


def test_ofz_schedule_has_long_first_period_then_182_day_periods() -> None:
    count = _period_count(
        placement_date=date(2024, 5, 15),
        maturity_date=date(2040, 5, 16),
        payments_per_year=2,
    )
    first = _period_at(
        placement_date=date(2024, 5, 15),
        maturity_date=date(2040, 5, 16),
        payments_per_year=2,
        coupon_period_days=182,
        index=0,
        period_count=count,
    )
    second = _period_at(
        placement_date=date(2024, 5, 15),
        maturity_date=date(2040, 5, 16),
        payments_per_year=2,
        coupon_period_days=182,
        index=1,
        period_count=count,
    )
    assert count == 32
    assert (first.start, first.end, (first.end - first.start).days) == (
        date(2024, 5, 15), date(2024, 12, 4), 203
    )
    assert (second.start, second.end, (second.end - second.start).days) == (
        date(2024, 12, 4), date(2025, 6, 4), 182
    )
```

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend\tests\test_portfolio_calculations.py -q
```

Expected: FAIL because `infer_coupon_period_days` and the new `coupon_period_days` parameter do not exist and the current second monthly boundary is `2025-11-12`.

- [ ] **Step 3: Implement default inference and ROUND_HALF_UP period count**

Replace calendar-month count arithmetic with:

```python
DEFAULT_COUPON_PERIOD_DAYS = {1: 365, 2: 182, 3: 122, 4: 91, 6: 61, 12: 30}


def infer_coupon_period_days(payments_per_year: int) -> int:
    return DEFAULT_COUPON_PERIOD_DAYS[payments_per_year]


def _period_count(
    *, placement_date: date, maturity_date: date, payments_per_year: int
) -> int:
    lifetime_days = (maturity_date - placement_date).days
    raw_count = Decimal(lifetime_days * payments_per_year) / Decimal(365)
    return max(1, int(raw_count.quantize(Decimal("1"), rounding=ROUND_HALF_UP)))
```

Keep `_shift_forward_from_anchor` only for maturity-remaining formatting; it no longer participates in coupon boundaries.

- [ ] **Step 4: Implement O(1) fixed-day `_period_at` and thread the parameter through searches**

Use maturity-anchored arithmetic:

```python
def _period_at(..., coupon_period_days: int, index: int, ...) -> CouponPeriod:
    count = period_count or _period_count(...)
    if index < 0 or index >= count:
        raise IndexError("coupon period index out of range")
    step = timedelta(days=coupon_period_days)
    start = (
        placement_date
        if index == 0
        else maturity_date - step * (count - index)
    )
    end = (
        maturity_date
        if index == count - 1
        else maturity_date - step * (count - index - 1)
    )
    if end <= start:
        raise ValueError("coupon period is incompatible with bond dates")
    return CouponPeriod(start=start, end=end, pay_date=next_business_day(end))
```

Add `coupon_period_days` to `_first_period_index`, `_paid_coupon_count`,
`coupon_dates_between`, and `calculate_bond_metrics`, passing it into every `_period_at` call.

- [ ] **Step 5: Update existing calculation fixtures and verify GREEN**

Every existing `calculate_bond_metrics` call supplies the intended fixed period, normally
`coupon_period_days=infer_coupon_period_days(payments_per_year)`. Update expected period boundaries while preserving expectations for pay-date shifting, purchase eligibility, zero coupons, status ordering, and decimal precision.

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend\tests\test_portfolio_calculations.py backend\tests\test_business_calendar.py -q
```

Expected: all selected tests PASS.

- [ ] **Step 6: Commit the schedule engine**

```powershell
git add backend/app/portfolio/calculations.py backend/tests/test_portfolio_calculations.py
git commit -m "fix: build coupon periods from fixed day intervals"
```

---

### Task 2: Persistence, Migration, Validation, and API Contract

**Files:**
- Create: `backend/migrations/versions/20260810_0004_add_coupon_period_days.py`
- Create: `backend/tests/test_coupon_period_migration.py`
- Modify: `backend/app/portfolio/models.py`
- Modify: `backend/app/portfolio/schemas.py`
- Modify: `backend/app/portfolio/service.py`
- Modify: `backend/tests/test_portfolio_api.py`
- Modify: `backend/tests/test_portfolio_persistence.py`

**Interfaces:**
- Consumes: `infer_coupon_period_days()` and fixed-day `calculate_bond_metrics()` from Task 1.
- Produces create input: `coupon_period_days: int | None = None`, resolved to an integer during validation.
- Produces card output: `coupon_period_days: int` / JSON `coupon_period_days`.
- Produces database column: `Bond.coupon_period_days: Mapped[int]`.

- [ ] **Step 1: Add failing API and persistence tests**

Update `valid_bond_payload()` so its default request can omit the field, then assert the server returns the inferred value. Add a manual override test and validation case:

```python
@pytest.mark.asyncio
async def test_create_infers_or_accepts_coupon_period_days(client: AsyncClient) -> None:
    await register(client, "CouponPeriodOwner")
    inferred = await client.post(
        "/api/portfolio/bonds", json=valid_bond_payload("Inferred period")
    )
    explicit_payload = valid_bond_payload("Explicit period")
    explicit_payload["coupon_period_days"] = 183
    explicit = await client.post("/api/portfolio/bonds", json=explicit_payload)
    assert inferred.status_code == 201
    assert inferred.json()["coupon_period_days"] == 182
    assert explicit.status_code == 201
    assert explicit.json()["coupon_period_days"] == 183


@pytest.mark.parametrize("value", [0, 367, 30.5, "30"])
@pytest.mark.asyncio
async def test_coupon_period_days_rejects_out_of_contract_values(
    client: AsyncClient, value: object
) -> None:
    await register(client, f"PeriodValue{str(value).replace('.', 'x')}")
    payload = valid_bond_payload()
    payload["coupon_period_days"] = value
    response = await client.post("/api/portfolio/bonds", json=payload)
    assert response.status_code == 422
    assert "coupon_period_days" in response.json()["field_errors"]
```

Add a raw SQL/model test proving the DB rejects `coupon_period_days=0`.

- [ ] **Step 2: Verify persistence/API RED**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest backend\tests\test_portfolio_api.py backend\tests\test_portfolio_persistence.py -q
```

Expected: FAIL because the field is absent from model, schemas, responses, and storage.

- [ ] **Step 3: Add the SQLAlchemy column and Pydantic resolution**

In `Bond`, add:

```python
coupon_period_days: Mapped[int] = mapped_column(Integer, nullable=False)
```

and:

```python
CheckConstraint(
    "coupon_period_days BETWEEN 1 AND 366",
    name="ck_bonds_coupon_period_days",
)
```

In `BondCreate`, put `coupon_period_days` after both bond dates so its validator can inspect all prerequisites:

```python
coupon_period_days: int | None = Field(
    default=None,
    validate_default=True,
    strict=True,
    ge=1,
    le=366,
)

@field_validator("coupon_period_days")
@classmethod
def resolve_coupon_period_days(cls, value: int | None, info: ValidationInfo) -> int:
    frequency = info.data["payments_per_year"]
    resolved = value if value is not None else infer_coupon_period_days(frequency)
    placement = info.data["placement_date"]
    maturity = info.data["maturity_date"]
    count = coupon_period_count(placement, maturity, frequency)
    first_end = maturity - timedelta(days=resolved * (count - 1))
    if first_end <= placement:
        raise ValueError("coupon_period_days is incompatible with bond dates")
    return resolved
```

Expose a named `coupon_period_count()` wrapper from calculations instead of importing a private helper into schemas. Add `coupon_period_days: int` to `BondCard`.

- [ ] **Step 4: Persist, calculate, and serialize the resolved value**

In `create_bond`, assert the validated value and assign it:

```python
assert data.coupon_period_days is not None
bond = Bond(..., coupon_period_days=data.coupon_period_days, ...)
```

In `build_bond_card`, pass `bond.coupon_period_days` to `calculate_bond_metrics` and include it in `BondCard`.

Update every direct `Bond(...)` test fixture and raw insert to provide `coupon_period_days`.

- [ ] **Step 5: Write the non-destructive migration and its failing operation test**

Create revision `20260810_0004`, down revision `20260810_0003`. Its upgrade performs:

```python
op.add_column("bonds", sa.Column("coupon_period_days", sa.SmallInteger(), nullable=True))
op.execute(sa.text("""
    UPDATE bonds
    SET coupon_period_days = CASE payments_per_year
        WHEN 1 THEN 365 WHEN 2 THEN 182 WHEN 3 THEN 122
        WHEN 4 THEN 91 WHEN 6 THEN 61 WHEN 12 THEN 30
    END
"""))
op.create_check_constraint(
    "ck_bonds_coupon_period_days",
    "bonds",
    "coupon_period_days BETWEEN 1 AND 366",
)
op.alter_column("bonds", "coupon_period_days", nullable=False)
```

Downgrade drops the constraint and column. The migration test uses a mocked Alembic `op` and asserts this exact order: `add_column`, `execute`, `create_check_constraint`, `alter_column`; it also asserts there is no `DELETE` operation.

- [ ] **Step 6: Verify backend integration GREEN**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest -q
backend\.venv\Scripts\python.exe -m compileall -q backend\app backend\migrations
```

Expected: complete backend suite PASS and compileall exit code 0.

- [ ] **Step 7: Commit persistence and API changes**

```powershell
git add backend/app/portfolio backend/migrations/versions/20260810_0004_add_coupon_period_days.py backend/tests
git commit -m "feat: persist coupon period duration"
```

---

### Task 3: Frontend Contract, Form Default, and Details

**Files:**
- Modify: `frontend/src/entities/bondPortfolio/types.ts`
- Modify: `frontend/src/entities/bondPortfolio/api.ts`
- Modify: `frontend/src/entities/bondPortfolio/__tests__/bondPortfolio.spec.ts`
- Modify: `frontend/src/pages/PortfolioPage/components/PortfolioForms/CreateBondForm.tsx`
- Modify: `frontend/src/pages/PortfolioPage/components/BondDetails/BondDetails.tsx`
- Modify: `frontend/src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx`
- Modify: `frontend/e2e/portfolio.spec.ts`

**Interfaces:**
- Consumes backend JSON `coupon_period_days: number`.
- Produces `BondPortfolioItem.couponPeriodDays: number`.
- Produces optional `CreateBondInput.couponPeriodDays?: number` and request `coupon_period_days` when supplied.
- Keeps all form behavior local to `PortfolioPage`; no new shared business module.

- [ ] **Step 1: Add failing entity transport tests**

Add `coupon_period_days: 182` to `activeDto`, expect `couponPeriodDays: 182` in the adapted item, and create with `couponPeriodDays: 182` expecting:

```typescript
expect(requests[0]?.body).toMatchObject({ coupon_period_days: 182 });
```

Add a second create serialization assertion where the optional property is absent and verify the JSON has no `coupon_period_days` key.

- [ ] **Step 2: Add failing form and detail tests**

Cover the inferred default and manual override:

```typescript
await user.selectOptions(screen.getByLabelText('Количество выплат в год'), '12');
expect(screen.getByLabelText('Купонный период, дней')).toHaveValue('30');
await user.clear(screen.getByLabelText('Купонный период, дней'));
await user.type(screen.getByLabelText('Купонный период, дней'), '31');
await user.selectOptions(screen.getByLabelText('Количество выплат в год'), '2');
expect(screen.getByLabelText('Купонный период, дней')).toHaveValue('31');
```

This proves automatic values update only until the user manually edits the field. Also assert zero, fractional, and values above 366 block submit, a server `coupon_period_days` error is attached to the field, and detail modal displays `Купонный период: 182 дня`.

- [ ] **Step 3: Verify frontend RED**

Run:

```powershell
Set-Location frontend
pnpm.cmd test src/entities/bondPortfolio/__tests__/bondPortfolio.spec.ts src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx --reporter=dot
```

Expected: FAIL because DTO types, field, default behavior, and detail copy are absent.

- [ ] **Step 4: Implement DTO/type adaptation and serialization**

Add:

```typescript
couponPeriodDays: number;
```

to `BondPortfolioItem`, optional `couponPeriodDays?: number` to `CreateBondInput`, and `coupon_period_days: number` to the DTO. Adapt it in `adaptBond`. Build the create JSON so the key is included only when defined:

```typescript
...(input.couponPeriodDays === undefined
  ? {}
  : { coupon_period_days: input.couponPeriodDays }),
```

- [ ] **Step 5: Implement inferred form value without overwriting manual edits**

Add `couponPeriodDays: string` to form values and `coupon_period_days` to `FIELD_MAP`. Define the page-local mapping:

```typescript
const COUPON_PERIOD_BY_FREQUENCY: Record<string, string> = {
  '1': '365', '2': '182', '3': '122', '4': '91', '6': '61', '12': '30',
};
```

Watch `paymentsPerYear`; while `dirtyFields.couponPeriodDays` is false, call `setValue` with the mapped value and `{ shouldValidate: true, shouldDirty: false }`. Render a `ControlledNumberField` labelled `Купонный период, дней`, using the calculator-style integer parser and validation that allows blank but otherwise requires an integer in `1…366`.

On submit, omit the property if blank; otherwise convert through `parseFormattedNumber`.

- [ ] **Step 6: Display the resolved period and update fixtures/E2E**

In `BondDetails`, add after annual frequency:

```tsx
<div><dt>Купонный период</dt><dd>{bond.couponPeriodDays} дней</dd></div>
```

Update all portfolio DTO fixtures with `coupon_period_days`. In E2E, select 12 payments, assert the inferred field equals `30`, create the bond, and verify the details modal contains `30 дней` and exchange-derived next period boundaries from the API.

- [ ] **Step 7: Verify frontend GREEN**

Run:

```powershell
Set-Location frontend
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit frontend changes**

```powershell
git add frontend/src/entities/bondPortfolio frontend/src/pages/PortfolioPage frontend/e2e/portfolio.spec.ts
git commit -m "feat: configure fixed coupon periods"
```

---

### Task 4: Documentation and End-to-End Verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Documents migration revision `20260810_0004`, inference mapping, manual override, and the limitation for irregular schedules.

- [ ] **Step 1: Document the new schedule model**

Add a concise README section explaining that coupon frequency selects a default fixed-day duration, regular boundaries are anchored backwards from maturity, the first period may be irregular, and `coupon_period_days` can override the default. State explicitly that migration `0004` backfills existing bonds without deleting portfolio data.

- [ ] **Step 2: Run final backend and frontend verification on the exact tree**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest -q
backend\.venv\Scripts\python.exe -m compileall -q backend\app backend\migrations
Set-Location frontend
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
node node_modules\@playwright\test\cli.js test portfolio.spec.ts --list
```

Expected: backend and frontend suites PASS; Playwright lists desktop and mobile portfolio scenarios.

- [ ] **Step 3: Run isolated Docker integration when Docker is available**

From repository root:

```powershell
docker compose config --quiet
docker compose -f compose.test.yaml up --build --abort-on-container-exit --exit-code-from backend-test
Set-Location frontend
pnpm.cmd test:e2e -- portfolio.spec.ts
```

Expected: migration applies to a real PostgreSQL database, backend tests pass, both portfolio E2E projects pass, and the temporary E2E volume is removed by the runner. If Docker is unavailable, record that environmental limitation and do not run E2E against the development database.

- [ ] **Step 4: Review the implementation against all four supplied exchange schedules**

Use the fixed-day engine to assert these representative boundaries before completion:

```text
2025-04-22 → 2025-05-22 → 2025-06-21 (30-day monthly issue)
2025-09-12 → 2025-10-12 → 2025-11-11 (30-day monthly issue)
2026-07-03 → 2026-08-02 → 2026-09-01 (30-day monthly issue)
2024-05-15 → 2024-12-04 → 2025-06-04 (203-day stub, then 182 days)
```

- [ ] **Step 5: Commit documentation**

```powershell
git add README.md docs/superpowers/plans/2026-08-10-fixed-day-coupon-schedule.md
git commit -m "docs: explain fixed coupon schedules"
```
