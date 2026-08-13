# App, Pages, and Component Utilities Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перестроить композицию `app`, разместить маршруты в `pages/index.tsx` и вынести все найденные верхнеуровневые utility-функции из React-компонентов по согласованному правилу.

**Architecture:** `App` становится результатом композиции HOC-провайдеров вокруг `Pages`; `Pages` владеет инициализацией пользователя и `useRoutes`. Каждая utility-функция остаётся у ближайшего компонента-владельца: одиночная функция живёт в `utils.ts`, несколько функций — по одному файлу внутри `utils` с barrel export и локальными unit-тестами.

**Tech Stack:** React 19, TypeScript 6, React Router 7, TanStack React Query 5, Vitest, Testing Library, pnpm.

## Global Constraints

- Соблюдать направление зависимостей `app → pages → widgets → entities → shared` и публичные API из `AGENTS.md`.
- Не создавать слой `features`, корневой `store` или новые runtime-обёртки без используемого сценария.
- Не менять URL, авторизацию, настройки React Query, тему, DOM-разметку или тексты интерфейса.
- Одна utility-функция у владельца размещается в `utils.ts`; две и более — в `utils/{functionName}.ts` с `utils/index.ts`.
- Для `utils.ts` каталог тестов находится рядом с файлом; для `utils` каталог `__tests__` находится внутри `utils`.
- React-компоненты `LoadingState` и `SignedValue`, типы и константы не выносить как utilities.
- Коммит не создавать.

---

### Task 1: App providers and Pages routing

**Files:**
- Create: `frontend/src/app/providers/withRouter.tsx`
- Create: `frontend/src/app/providers/withQueryProvider.tsx`
- Create: `frontend/src/app/providers/withTheme.tsx`
- Create: `frontend/src/app/providers/index.ts`
- Create: `frontend/src/pages/__tests__/Pages.spec.tsx`
- Modify: `frontend/src/app/index.ts`
- Delete: `frontend/src/app/App.tsx`
- Replace: `frontend/src/pages/index.ts` → `frontend/src/pages/index.tsx`
- Verify: `frontend/src/app/__tests__/App.spec.tsx`

**Interfaces:**
- Consumes: `useTheme(): { theme: Theme; toggleTheme: () => void }`, `useUserStore`, `BondCalculatorPage`, `PortfolioPage`.
- Produces: `Pages(props: { theme: 'light' | 'dark'; toggleTheme: () => void })`, `withProviders(Component)`, and `App` through `#app`.

- [ ] **Step 1: Add a failing public-API test for `Pages`**

```tsx
import { describe, expect, it } from 'vitest';

describe('pages public API', () => {
  it('exports the root Pages component', async () => {
    const pages = await import('#pages');
    expect(pages).toHaveProperty('Pages');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm test src/pages/__tests__/Pages.spec.tsx`

Expected: FAIL because the current `#pages` module has no `Pages` export.

- [ ] **Step 3: Implement provider HOCs and route composition**

`withRouter` wraps a no-props component in `BrowserRouter`. `withQueryProvider` owns one module-level `QueryClient` with the existing options `{ queries: { retry: 1, staleTime: 30_000 }, mutations: { retry: false } }`. `withTheme` accepts a component requiring the return value of `useTheme`, calls the hook, and injects those props.

`withProviders` first converts the themed root component to a no-props component with `withTheme`, then applies `withQueryProvider` and `withRouter`, leaving Router outermost. `src/app/index.ts` becomes:

```ts
import { Pages } from '#pages';

import { withProviders } from './providers';

export const App = withProviders(Pages);
```

`src/pages/index.tsx` exports `Pages`, calls `initialize()` from an effect, and passes this exact route set to `useRoutes`:

```tsx
[
  { path: '/', element: <BondCalculatorPage theme={theme} toggleTheme={toggleTheme} /> },
  {
    path: '/portfolio',
    element: status === 'checking'
      ? <div aria-label="Проверка авторизации" />
      : status === 'authenticated'
        ? <PortfolioPage theme={theme} toggleTheme={toggleTheme} />
        : <Navigate to="/" replace />,
  },
  { path: '*', element: <Navigate to="/" replace /> },
]
```

- [ ] **Step 4: Run focused routing tests and verify GREEN**

Run: `pnpm test src/pages/__tests__/Pages.spec.tsx src/app/__tests__/App.spec.tsx`

Expected: both test files PASS; authenticated and anonymous `/portfolio` behavior remains unchanged.

---

### Task 2: Single-function utility modules

**Files:**
- Create: `frontend/src/pages/BondCalculatorPage/utils.ts`
- Create: `frontend/src/pages/BondCalculatorPage/__tests__/utils.spec.ts`
- Modify: `frontend/src/pages/BondCalculatorPage/BondCalculatorPage.tsx`
- Create: `frontend/src/shared/ui/TextField/utils.ts`
- Create: `frontend/src/shared/ui/TextField/__tests__/utils.spec.ts`
- Modify: `frontend/src/shared/ui/TextField/NumberField.tsx`

**Interfaces:**
- Produces: `collectPreset(formValues: BondCalculatorFormValues): SavedBondCalculation` and `getValueAfterInsertion(input: HTMLInputElement, insertedValue: string): string`.

- [ ] **Step 1: Add behavior tests in the required test locations**

Import the future utility modules directly. Add behavior cases proving that `collectPreset` trims the name and parses formatted numeric fields, while `getValueAfterInsertion` replaces the selected range and appends at the end when selection offsets are null.

- [ ] **Step 2: Run both tests and verify RED**

Run: `pnpm test src/pages/BondCalculatorPage/__tests__/utils.spec.ts src/shared/ui/TextField/__tests__/utils.spec.ts`

Expected: FAIL because the behavior tests cannot yet resolve the future `utils.ts` modules.

- [ ] **Step 3: Move the functions and update relative imports**

Move implementations without semantic edits. Export both functions from their new `utils.ts` files. Remove now-unused imports (`createPresetId`, `parseFormattedNumber`, and related symbols where applicable) from component files.

- [ ] **Step 4: Run both utility tests and affected component tests**

Run: `pnpm test src/pages/BondCalculatorPage/__tests__/utils.spec.ts src/pages/BondCalculatorPage/__tests__/BondCalculatorPage.spec.tsx src/shared/ui/TextField/__tests__/utils.spec.ts`

Expected: PASS.

---

### Task 3: Portfolio component utility directories

**Files:**
- Create: `frontend/src/pages/PortfolioPage/components/PortfolioSummary/utils/signedMoney.ts`
- Create: `frontend/src/pages/PortfolioPage/components/PortfolioSummary/utils/resultClassName.ts`
- Create: `frontend/src/pages/PortfolioPage/components/PortfolioSummary/utils/index.ts`
- Create: `frontend/src/pages/PortfolioPage/components/PortfolioSummary/utils/__tests__/utils.spec.ts`
- Modify: `frontend/src/pages/PortfolioPage/components/PortfolioSummary/PortfolioSummary.tsx`
- Create: `frontend/src/pages/PortfolioPage/components/BondDetails/utils/maturityValue.ts`
- Create: `frontend/src/pages/PortfolioPage/components/BondDetails/utils/formatOperationCount.ts`
- Create: `frontend/src/pages/PortfolioPage/components/BondDetails/utils/resultSign.ts`
- Create: `frontend/src/pages/PortfolioPage/components/BondDetails/utils/formatOperationResult.ts`
- Create: `frontend/src/pages/PortfolioPage/components/BondDetails/utils/index.ts`
- Create: `frontend/src/pages/PortfolioPage/components/BondDetails/utils/__tests__/utils.spec.ts`
- Modify: `frontend/src/pages/PortfolioPage/components/BondDetails/BondDetails.tsx`
- Create: `frontend/src/pages/PortfolioPage/components/BondPortfolioCard/utils/maturityLabel.ts`
- Create: `frontend/src/pages/PortfolioPage/components/BondPortfolioCard/utils/couponProgress.ts`
- Create: `frontend/src/pages/PortfolioPage/components/BondPortfolioCard/utils/index.ts`
- Create: `frontend/src/pages/PortfolioPage/components/BondPortfolioCard/utils/__tests__/utils.spec.ts`
- Modify: `frontend/src/pages/PortfolioPage/components/BondPortfolioCard/BondPortfolioCard.tsx`
- Create: `frontend/src/pages/PortfolioPage/components/PortfolioForms/utils/previousDate.ts`
- Create: `frontend/src/pages/PortfolioPage/components/PortfolioForms/utils/localizedFieldError.ts`
- Create: `frontend/src/pages/PortfolioPage/components/PortfolioForms/utils/localizedSubmitError.ts`
- Create: `frontend/src/pages/PortfolioPage/components/PortfolioForms/utils/index.ts`
- Create: `frontend/src/pages/PortfolioPage/components/PortfolioForms/utils/__tests__/utils.spec.ts`
- Modify: `frontend/src/pages/PortfolioPage/components/PortfolioForms/AddSaleForm.tsx`

**Interfaces:**
- Produces exactly the named functions above, imported only through each local `utils/index.ts`.

- [ ] **Step 1: Add behavior tests under each `utils/__tests__`**

Import the future local barrels directly and add these behavior matrices:

```ts
expect(signedMoney('10.50')).toContain('+');
expect(signedMoney('-10.50')).not.toMatch(/^\+/);
expect(resultSign('0.00')).toBe('zero');
expect(resultSign('-1')).toBe('negative');
expect(resultSign('1')).toBe('positive');
expect(formatOperationCount(1)).toContain('1');
expect(couponProgress(100, 50)).toBe(50);
expect(couponProgress(0, 50)).toBe(0);
expect(couponProgress(100, 150)).toBe(100);
expect(previousDate('2026-08-14')).toBe('2026-08-13');
expect(localizedFieldError('unknown')).toBeNull();
expect(localizedSubmitError('validation_error')).not.toBe(localizedSubmitError('server_error'));
```

For maturity labels, use typed partial fixtures cast to `BondPortfolioItem` and assert distinct results for `active`, `matured`, and `payment_pending`.

- [ ] **Step 2: Run the four new test files and verify RED**

Run: `pnpm test src/pages/PortfolioPage/components/PortfolioSummary/utils/__tests__/utils.spec.ts src/pages/PortfolioPage/components/BondDetails/utils/__tests__/utils.spec.ts src/pages/PortfolioPage/components/BondPortfolioCard/utils/__tests__/utils.spec.ts src/pages/PortfolioPage/components/PortfolioForms/utils/__tests__/utils.spec.ts`

Expected: FAIL because the future utility barrels cannot yet be resolved.

- [ ] **Step 3: Move one function per identically named file and add barrel exports**

Each `index.ts` re-exports only its named local utilities. Functions that depend on another utility import it from the sibling file, for example `formatOperationResult.ts` imports `resultSign` from `./resultSign`, not from its own barrel. Component files import from `./utils`.

- [ ] **Step 4: Run utility and portfolio component tests**

Run: `pnpm test src/pages/PortfolioPage/components/PortfolioSummary/utils/__tests__/utils.spec.ts src/pages/PortfolioPage/components/BondDetails/utils/__tests__/utils.spec.ts src/pages/PortfolioPage/components/BondPortfolioCard/utils/__tests__/utils.spec.ts src/pages/PortfolioPage/components/PortfolioForms/utils/__tests__/utils.spec.ts src/pages/PortfolioPage/__tests__/PortfolioPage.spec.tsx src/pages/PortfolioPage/__tests__/PortfolioSummary.spec.ts`

Expected: PASS.

---

### Task 4: BondCalculatorForm utility directory

**Files:**
- Create: `frontend/src/pages/BondCalculatorPage/components/BondCalculatorForm/utils/toLocalDateInputValue.ts`
- Create: `frontend/src/pages/BondCalculatorPage/components/BondCalculatorForm/utils/getDefaultMaturityDate.ts`
- Create: `frontend/src/pages/BondCalculatorPage/components/BondCalculatorForm/utils/getTomorrow.ts`
- Create: `frontend/src/pages/BondCalculatorPage/components/BondCalculatorForm/utils/formatted.ts`
- Create: `frontend/src/pages/BondCalculatorPage/components/BondCalculatorForm/utils/getDefaultValues.ts`
- Create: `frontend/src/pages/BondCalculatorPage/components/BondCalculatorForm/utils/validateCalculation.ts`
- Create: `frontend/src/pages/BondCalculatorPage/components/BondCalculatorForm/utils/types.ts`
- Create: `frontend/src/pages/BondCalculatorPage/components/BondCalculatorForm/utils/index.ts`
- Create: `frontend/src/pages/BondCalculatorPage/components/BondCalculatorForm/utils/__tests__/utils.spec.ts`
- Modify: `frontend/src/pages/BondCalculatorPage/components/BondCalculatorForm/BondCalculatorForm.tsx`

**Interfaces:**
- Produces: the six named functions plus `ValidationErrors` and `CalculationValidation` types needed by the component.

- [ ] **Step 1: Add deterministic utility behavior tests**

Use fake timers/system time set to `2026-08-14T12:00:00+03:00`. Assert:

```ts
expect(toLocalDateInputValue(new Date(2026, 7, 4))).toBe('2026-08-04');
expect(getTomorrow()).toBe('2026-08-15');
expect(getDefaultMaturityDate()).toBe('2031-08-14');
expect(formatted(1000)).toMatch(/^1\s000$/);
expect(getDefaultValues().holdToMaturity).toBe('yes');
expect(validateCalculation(validValues).errors).toEqual({});
expect(validateCalculation({ ...validValues, nominal: '0' }).input).toBeNull();
```

The test imports the future `../index.ts` barrel directly.

- [ ] **Step 2: Run the new test and verify RED**

Run: `pnpm test src/pages/BondCalculatorPage/components/BondCalculatorForm/utils/__tests__/utils.spec.ts`

Expected: FAIL because `utils/index.ts` is absent.

- [ ] **Step 3: Move functions, supporting types, and internal dependencies**

Move each function unchanged. Move `ValidationErrors` and `CalculationValidation` to `utils/types.ts`, because `validateCalculation.ts` and the component both consume them. Keep `calculationFields` in `BondCalculatorForm.tsx`, because it is a component-owned constant rather than a utility. Use sibling imports between utility files to avoid barrel cycles.

- [ ] **Step 4: Run utility and calculator component tests**

Run: `pnpm test src/pages/BondCalculatorPage/components/BondCalculatorForm/utils/__tests__/utils.spec.ts src/pages/BondCalculatorPage/__tests__/BondCalculatorPage.spec.tsx`

Expected: PASS.

---

### Task 5: Modal utility directory and shared stack state

**Files:**
- Create: `frontend/src/shared/ui/Modal/utils/types.ts`
- Create: `frontend/src/shared/ui/Modal/utils/modalStackState.ts`
- Create: `frontend/src/shared/ui/Modal/utils/topmostModal.ts`
- Create: `frontend/src/shared/ui/Modal/utils/handleDocumentKeyDown.ts`
- Create: `frontend/src/shared/ui/Modal/utils/focusableElements.ts`
- Create: `frontend/src/shared/ui/Modal/utils/mountModal.ts`
- Create: `frontend/src/shared/ui/Modal/utils/unmountModal.ts`
- Create: `frontend/src/shared/ui/Modal/utils/index.ts`
- Create: `frontend/src/shared/ui/Modal/utils/__tests__/utils.spec.ts`
- Modify: `frontend/src/shared/ui/Modal/Modal.tsx`
- Verify: `frontend/src/shared/ui/Modal/__tests__/Modal.spec.tsx`

**Interfaces:**
- Produces: `ModalStackEntry`, one module-local shared `modalStackState`, and the five named utility functions exported through `utils/index.ts`.

- [ ] **Step 1: Add focused stack utility behavior tests**

The test imports the future `../index.ts` barrel, creates real dialog/button nodes, and verifies that `focusableElements` excludes disabled, hidden-input, hidden-attribute, and negative-tabindex nodes; `mountModal` locks body scrolling; `topmostModal` returns the last mounted entry; and `unmountModal` restores body overflow and prior focus after the last entry.

- [ ] **Step 2: Run Modal utility test and verify RED**

Run: `pnpm test src/shared/ui/Modal/utils/__tests__/utils.spec.ts`

Expected: FAIL because `utils/index.ts` is absent.

- [ ] **Step 3: Extract the stack without changing singleton semantics**

`modalStackState.ts` stores entries, the previous body overflow, and the stack return-focus target in one exported object. Each function lives in its identically named file; direct sibling imports are used internally, and `index.ts` exposes the utility API consumed by `Modal.tsx` and tests.

- [ ] **Step 4: Run utility and existing Modal component tests**

Run: `pnpm test src/shared/ui/Modal/utils/__tests__/utils.spec.ts src/shared/ui/Modal/__tests__/Modal.spec.tsx`

Expected: PASS with scroll lock, focus restoration, Escape handling, focus wrapping, and nested-modal behavior unchanged.

---

### Task 6: Structural audit and full verification

**Files:**
- Modify only files required to fix verification findings within the approved scope.

**Interfaces:**
- Consumes all outputs from Tasks 1–5.
- Produces a verified working tree with no commit.

- [ ] **Step 1: Audit remaining top-level function declarations in component files**

Run: `rg -n "^(const|function) [A-Za-z]" src --glob "*.tsx"`

Classify every match. The only intentional component-level functions above main components are React components such as `LoadingState` and `SignedValue`; constants and primary exported components are allowed. Move any missed utility according to the same one-vs-many rule and place its test accordingly.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: exit code 0 and zero warnings.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`

Expected: exit code 0.

- [ ] **Step 4: Run unit/component tests**

Run: `pnpm test`

Expected: exit code 0 and zero failed tests.

- [ ] **Step 5: Run E2E tests**

Run: `pnpm test:e2e`

Expected: exit code 0 and zero failed scenarios.

- [ ] **Step 6: Run production build**

Run: `pnpm build`

Expected: exit code 0.

- [ ] **Step 7: Review the final uncommitted diff**

Run from repository root: `git -c safe.directory=C:/Users/moxxie/Desktop/bonds status --short` and `git -c safe.directory=C:/Users/moxxie/Desktop/bonds diff --check`.

Expected: only approved frontend refactor, tests, spec, and plan are present; `diff --check` reports no whitespace errors; no commit is created.
